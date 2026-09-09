import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const providerState = vi.hoisted(() => ({
  calls: [] as Array<{ captureId: string; requestId: string }>,
  refunds: new Map<string, { id: string; status: "COMPLETED" }>(),
}));

vi.mock("../shared/utils/paypal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared/utils/paypal.js")>();
  return {
    ...actual,
    refundPayPalCapture: vi.fn(async (captureId: string, requestId: string) => {
      providerState.calls.push({ captureId, requestId });
      const replay = providerState.refunds.get(requestId);
      if (replay) return replay;
      const created = { id: `PROVIDER-REFUND-${providerState.refunds.size + 1}`, status: "COMPLETED" as const };
      providerState.refunds.set(requestId, created);
      return created;
    }),
  };
});

import { prisma } from "../shared/database/index.js";
import { refundPayPalCapture } from "../shared/utils/paypal.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import {
  buildPayPalRefundRequestId,
  refundsService,
} from "../modules/payments/refunds.service.js";
import {
  createCheckoutGraph,
  createOrder,
  createUser,
  orderKey,
} from "./helpers/index.js";

function completedCaptureEvent(
  eventId: string,
  orderId: string,
  captureId: string,
  paypalOrderId = `PAYPAL-${orderId}`
) {
  return {
    id: eventId,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: captureId,
      purchase_units: [{ reference_id: orderId }],
      supplementary_data: { related_ids: { order_id: paypalOrderId } },
    },
  };
}

function approvedEvent(eventId: string, orderId: string) {
  return {
    id: eventId,
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: {
      id: `PAYPAL-${orderId}`,
      purchase_units: [{ reference_id: orderId }],
    },
  };
}

async function obligation(orderId: string, captureId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  return refundsService.createObligation({
    orderId,
    providerCaptureId: captureId,
    amount: order.totalAmount,
  });
}

describe("TASK-0014 idempotent PayPal refund execution (postgres)", () => {
  beforeEach(() => {
    providerState.calls.length = 0;
    providerState.refunds.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies a provider-completed full refund locally exactly once", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("refund-provider-completed")
    );
    const refund = await obligation(order.id, "CAPTURE-COMPLETED");

    const first = await refundsService.executeProviderRefund(refund.id);
    const replay = await refundsService.executeProviderRefund(refund.id);

    expect(first.refund.status).toBe("COMPLETED");
    expect(replay.refund.status).toBe("COMPLETED");
    expect(providerState.refunds.size).toBe(1);
    expect(providerState.calls).toHaveLength(1);
    expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      "REFUNDED"
    );
  });

  it("uses one economic provider refund for concurrent callers", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("refund-provider-concurrent")
    );
    const refund = await obligation(order.id, "CAPTURE-CONCURRENT");

    const results = await Promise.all([
      refundsService.executeProviderRefund(refund.id),
      refundsService.executeProviderRefund(refund.id),
      refundsService.executeProviderRefund(refund.id),
    ]);

    expect(results.every((result) => result.refund.status === "COMPLETED")).toBe(true);
    expect(providerState.refunds.size).toBe(1);
    expect(new Set(providerState.calls.map((call) => call.requestId))).toEqual(
      new Set([buildPayPalRefundRequestId(refund.id)])
    );
    expect(await prisma.refund.count({ where: { providerCaptureId: "CAPTURE-CONCURRENT" } })).toBe(1);
  });

  it("converges when PayPal succeeds and the process crashes before local completion", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("refund-provider-crash")
    );
    const refund = await obligation(order.id, "CAPTURE-CRASH");
    const completion = vi
      .spyOn(refundsService, "recordProviderConfirmedCompletion")
      .mockRejectedValueOnce(new Error("simulated crash before local commit"));

    await expect(refundsService.executeProviderRefund(refund.id)).rejects.toThrow(
      "simulated crash"
    );
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe(
      "PROCESSING"
    );

    const replay = await refundsService.executeProviderRefund(refund.id);

    expect(replay.refund.status).toBe("COMPLETED");
    expect(completion).toHaveBeenCalledTimes(2);
    expect(providerState.refunds.size).toBe(1);
    expect(providerState.calls.map((call) => call.requestId)).toEqual([
      buildPayPalRefundRequestId(refund.id),
      buildPayPalRefundRequestId(refund.id),
    ]);
  });

  it("keeps timeout state unresolved and reuses the same PayPal request id", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("refund-provider-timeout")
    );
    const refund = await obligation(order.id, "CAPTURE-TIMEOUT");
    const timeout = Object.assign(new Error("timeout"), { statusCode: 504 });
    vi.mocked(refundPayPalCapture).mockRejectedValueOnce(timeout);

    await expect(refundsService.executeProviderRefund(refund.id)).rejects.toBe(timeout);
    const unresolved = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(unresolved.status).toBe("PROCESSING");
    expect(unresolved.completedAt).toBeNull();

    vi.mocked(refundPayPalCapture).mockImplementationOnce(async (captureId, requestId) => {
      providerState.calls.push({ captureId, requestId });
      const result = { id: "PROVIDER-REFUND-TIMEOUT", status: "COMPLETED" as const };
      providerState.refunds.set(requestId, result);
      return result;
    });
    await refundsService.executeProviderRefund(refund.id);

    const requestIds = vi.mocked(refundPayPalCapture).mock.calls.map((call) => call[1]);
    expect(requestIds).toEqual([
      buildPayPalRefundRequestId(refund.id),
      buildPayPalRefundRequestId(refund.id),
    ]);
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe(
      "COMPLETED"
    );
  });

  it("persists a known provider refund identity without treating PENDING as completion", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("refund-provider-pending")
    );
    const refund = await obligation(order.id, "CAPTURE-PENDING");
    vi.mocked(refundPayPalCapture).mockResolvedValueOnce({
      id: "PROVIDER-REFUND-PENDING",
      status: "PENDING",
    });

    const result = await refundsService.executeProviderRefund(refund.id);

    expect(result.refund.status).toBe("PROCESSING");
    expect(result.refund.providerRefundId).toBe("PROVIDER-REFUND-PENDING");
    expect(result.refund.completedAt).toBeNull();
    expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(0);
  });

  it("compensates a previously credited seller exactly once", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("refund-provider-credit")
    );
    await paymentsService.confirmPayment(order.id);
    const credited = await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } });
    const refund = await obligation(order.id, "CAPTURE-CREDITED");

    await Promise.all([
      refundsService.executeProviderRefund(refund.id),
      refundsService.executeProviderRefund(refund.id),
    ]);

    const seller = await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } });
    const movements = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    expect(credited.balance.toString()).toBe("90");
    expect(seller.balance.toString()).toBe("0");
    expect(movements.map((movement) => movement.netAmount.toString()).sort()).toEqual([
      "-90",
      "90",
    ]);
    expect(movements.filter((movement) => movement.refundId === refund.id)).toHaveLength(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      "REFUNDED"
    );
  });

  it("refunds a late capture without stealing another order's reservation or debiting a seller", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const otherBuyer = await createUser({ name: "Refund Buyer 2" });
    const staleOrder = await createOrder(
      fixture.customer.id,
      [listingId],
      orderKey("refund-provider-stale")
    );
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        status: "ACTIVE",
        reservedAt: null,
        reservationExpiresAt: null,
        reservedByOrderId: null,
      },
    });
    const currentOrder = await createOrder(
      otherBuyer.id,
      [listingId],
      orderKey("refund-provider-current")
    );

    await paymentsService.handleWebhook(
      completedCaptureEvent("WH-REFUND-STALE", staleOrder.id, "CAPTURE-STALE")
    );

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    const refund = await prisma.refund.findUniqueOrThrow({
      where: {
        provider_providerCaptureId: { provider: "PAYPAL", providerCaptureId: "CAPTURE-STALE" },
      },
    });
    expect(listing.status).toBe("RESERVED");
    expect(listing.reservedByOrderId).toBe(currentOrder.id);
    expect(refund.status).toBe("COMPLETED");
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: staleOrder.id } })).paymentStatus
    ).toBe("REFUNDED");
    expect(await prisma.sellerTransaction.count({ where: { orderId: staleOrder.id } })).toBe(0);
    expect(
      (await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } })).balance.toString()
    ).toBe("0");
  });

  it("converges duplicate and out-of-order events to one obligation and refund", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(
      fixture.customer.id,
      [listingId],
      orderKey("refund-provider-events")
    );
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1_000) },
    });

    await paymentsService.handleWebhook(approvedEvent("WH-REFUND-APPROVED", order.id));
    await paymentsService.handleWebhook(
      completedCaptureEvent("WH-REFUND-CAPTURE-1", order.id, "CAPTURE-EVENTS")
    );
    await paymentsService.handleWebhook(
      completedCaptureEvent("WH-REFUND-CAPTURE-2", order.id, "CAPTURE-EVENTS")
    );

    expect(await prisma.refund.count({ where: { providerCaptureId: "CAPTURE-EVENTS" } })).toBe(1);
    expect(providerState.refunds.size).toBe(1);
    expect(await prisma.sellerTransaction.count({ where: { orderId: order.id } })).toBe(0);
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("RESERVED");
    expect(listing.reservedByOrderId).toBe(order.id);
  });
});
