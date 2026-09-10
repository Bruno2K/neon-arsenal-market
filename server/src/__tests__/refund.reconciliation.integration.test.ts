import { Prisma, type RefundStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  postCalls: [] as Array<{ captureId: string; requestId: string }>,
  getCalls: [] as string[],
  refundsByRequest: new Map<string, string>(),
  statuses: new Map<string, "CANCELLED" | "FAILED" | "PENDING" | "COMPLETED">(),
  postFailures: [] as Error[],
  getFailures: [] as Error[],
}));

vi.mock("../modules/payments/paypal-provider.gateway.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../modules/payments/paypal-provider.gateway.js")>();
  return {
    ...actual,
    paypalProvider: {
      ...actual.paypalProvider,
      refundCapture: vi.fn(async (captureId: string, requestId: string) => {
        provider.postCalls.push({ captureId, requestId });
        const failure = provider.postFailures.shift();
        if (failure) throw failure;
        let providerRefundId = provider.refundsByRequest.get(requestId);
        if (!providerRefundId) {
          providerRefundId = `PROVIDER-${provider.refundsByRequest.size + 1}`;
          provider.refundsByRequest.set(requestId, providerRefundId);
          provider.statuses.set(providerRefundId, "COMPLETED");
        }
        return { id: providerRefundId, status: provider.statuses.get(providerRefundId) ?? "PENDING" };
      }),
      getRefund: vi.fn(async (providerRefundId: string) => {
        provider.getCalls.push(providerRefundId);
        const failure = provider.getFailures.shift();
        if (failure) throw failure;
        return { id: providerRefundId, status: provider.statuses.get(providerRefundId) ?? "PENDING" };
      }),
    },
  };
});

import { prisma } from "../shared/database/index.js";
import { commissionsService } from "../modules/commissions/commissions.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import {
  buildPayPalRefundRequestId,
  refundsService,
} from "../modules/payments/refunds.service.js";
import { createCheckoutGraph, createOrder, orderKey } from "./helpers/index.js";

const NOW = new Date("2026-09-09T12:00:00.000Z");
const OLD = new Date("2026-09-07T00:00:00.000Z");

async function createRefund(options: {
  label: string;
  credited?: boolean;
  status?: Exclude<RefundStatus, "COMPLETED">;
  providerRefundId?: string;
  createdAt?: Date;
}) {
  const fixture = await createCheckoutGraph();
  const order = await createOrder(
    fixture.customer.id,
    [fixture.listings[0].id],
    orderKey(options.label)
  );
  if (options.credited) await paymentsService.confirmPayment(order.id);
  const refund = await refundsService.createObligation({
    orderId: order.id,
    providerCaptureId: `CAPTURE-${options.label}`,
    amount: order.totalAmount,
  });
  return {
    fixture,
    order,
    refund: await prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: options.status ?? "PROCESSING",
        providerRefundId: options.providerRefundId,
        createdAt: options.createdAt ?? OLD,
        updatedAt: OLD,
      },
    }),
  };
}

describe("TASK-0015 refund reconciliation (postgres)", () => {
  beforeEach(() => {
    provider.postCalls.length = 0;
    provider.getCalls.length = 0;
    provider.refundsByRequest.clear();
    provider.statuses.clear();
    provider.postFailures.length = 0;
    provider.getFailures.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converges remote COMPLETED plus local PROCESSING and repeats as a no-op", async () => {
    const { refund, order } = await createRefund({
      label: "remote-completed",
      providerRefundId: "REFUND-REMOTE-COMPLETED",
    });
    provider.statuses.set("REFUND-REMOTE-COMPLETED", "COMPLETED");

    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({
      scanned: 1,
      attempted: 1,
      converged: 1,
    });
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("COMPLETED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("REFUNDED");
    expect(await refundsService.reconcileUnresolvedRefunds(new Date(NOW.getTime() + 3_600_000))).toMatchObject({
      scanned: 0,
      attempted: 0,
      converged: 0,
    });
  });

  it("recovers remote success after a local crash and applies ledger completion once", async () => {
    const { refund, fixture, order } = await createRefund({
      label: "local-crash",
      credited: true,
      status: "PENDING",
    });
    const completion = vi
      .spyOn(refundsService, "recordProviderConfirmedCompletion")
      .mockRejectedValueOnce(new Error("simulated local crash"));

    await expect(refundsService.executeProviderRefund(refund.id)).rejects.toThrow("simulated local crash");
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("PROCESSING");
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).providerRefundId).toBeNull();
    await prisma.refund.update({ where: { id: refund.id }, data: { updatedAt: OLD } });
    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({ converged: 1 });

    expect(completion).toHaveBeenCalledTimes(2);
    expect(provider.postCalls.map((call) => call.requestId)).toEqual([
      buildPayPalRefundRequestId(refund.id),
      buildPayPalRefundRequestId(refund.id),
    ]);
    expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(1);
    expect((await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } })).balance.isZero()).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("REFUNDED");
  });

  it("keeps provider PENDING unresolved without seller compensation", async () => {
    const { refund, fixture } = await createRefund({
      label: "pending",
      credited: true,
      providerRefundId: "REFUND-PENDING",
    });
    provider.statuses.set("REFUND-PENDING", "PENDING");

    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({ stillPending: 1 });
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("PROCESSING");
    expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(0);
    expect((await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } })).balance.equals(new Prisma.Decimal("90"))).toBe(true);
  });

  it.each([
    Object.assign(new Error("PayPal RefundsGet timed out"), { statusCode: 504 }),
    Object.assign(new Error("PayPal RefundsGet failed: 503"), { statusCode: 502 }),
  ])("defers timeout and 5xx ambiguity without marking completion", async (failure) => {
    const { refund } = await createRefund({
      label: `transient-${failure.message}`,
      providerRefundId: `REFUND-${failure.message}`,
    });
    provider.getFailures.push(failure);

    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({ retryableFailures: 1, converged: 0 });
    const unresolved = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(unresolved.status).toBe("PROCESSING");
    expect(unresolved.completedAt).toBeNull();
  });

  it("records trusted provider terminal failure and operator evidence", async () => {
    const { refund } = await createRefund({
      label: "terminal",
      providerRefundId: "REFUND-TERMINAL",
    });
    provider.statuses.set("REFUND-TERMINAL", "FAILED");

    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({
      terminalFailures: 1,
      operatorRequired: 1,
    });
    const failed = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toBe("paypal_refund_failed");
  });

  it("replays an unknown prior POST outcome with exactly the same PayPal-Request-Id", async () => {
    const { refund } = await createRefund({ label: "unknown-post", status: "PENDING" });
    const timeout = Object.assign(new Error("PayPal CapturesRefund timed out"), { statusCode: 504 });
    provider.postFailures.push(timeout);
    await expect(refundsService.executeProviderRefund(refund.id)).rejects.toBe(timeout);
    const firstRequestId = provider.postCalls[0]!.requestId;
    await prisma.refund.update({ where: { id: refund.id }, data: { updatedAt: OLD } });

    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({ converged: 1 });
    expect(provider.postCalls.map((call) => call.requestId)).toEqual([firstRequestId, firstRequestId]);
    expect(firstRequestId).toBe(buildPayPalRefundRequestId(refund.id));
    expect(new Set(provider.refundsByRequest.values()).size).toBe(1);
  });

  it("treats PREVIOUS_REQUEST_IN_PROGRESS-equivalent 409 as retryable ambiguity", async () => {
    const { refund } = await createRefund({ label: "request-in-progress", status: "PENDING" });
    provider.postFailures.push(
      Object.assign(new Error("PayPal CapturesRefund failed: 409"), { statusCode: 502 })
    );

    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({
      retryableFailures: 1,
      terminalFailures: 0,
      converged: 0,
    });
    const unresolved = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(unresolved.status).toBe("PROCESSING");
    expect(unresolved.failureReason).toBe("paypal_request_in_progress");
    expect(provider.postCalls[0]!.requestId).toBe(buildPayPalRefundRequestId(refund.id));

    await prisma.refund.update({ where: { id: refund.id }, data: { updatedAt: OLD } });
    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({ converged: 1 });
    expect(new Set(provider.postCalls.map((call) => call.requestId))).toEqual(
      new Set([buildPayPalRefundRequestId(refund.id)])
    );
  });

  it("lets concurrent workers claim once and never double-debits a credited seller", async () => {
    const { refund, fixture } = await createRefund({
      label: "concurrent-workers",
      credited: true,
      status: "PENDING",
    });

    const results = await Promise.all([
      refundsService.reconcileUnresolvedRefunds(NOW),
      refundsService.reconcileUnresolvedRefunds(NOW),
    ]);
    expect(results.reduce((sum, result) => sum + result.attempted, 0)).toBe(1);
    expect(new Set(provider.postCalls.map((call) => call.requestId))).toEqual(new Set([buildPayPalRefundRequestId(refund.id)]));
    expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(1);
    expect((await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } })).balance.isZero()).toBe(true);
  });

  it("creates no negative movement when the original seller credit does not exist", async () => {
    const { refund, fixture } = await createRefund({
      label: "no-credit",
      providerRefundId: "REFUND-NO-CREDIT",
    });
    provider.statuses.set("REFUND-NO-CREDIT", "COMPLETED");
    await refundsService.reconcileUnresolvedRefunds(NOW);

    expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(0);
    expect((await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } })).balance.isZero()).toBe(true);
  });

  it("cannot downgrade COMPLETED from an out-of-order PENDING observation", async () => {
    const { refund } = await createRefund({
      label: "out-of-order",
      providerRefundId: "REFUND-OUT-OF-ORDER",
    });
    provider.statuses.set("REFUND-OUT-OF-ORDER", "COMPLETED");
    await refundsService.reconcileUnresolvedRefunds(NOW);

    await refundsService.recordProviderObservation({
      refundId: refund.id,
      providerRefundId: "REFUND-OUT-OF-ORDER",
      status: "PENDING",
    });
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("COMPLETED");
  });

  it("remains consistent across refund and seller-ledger reconciliation sweeps", async () => {
    const { refund, fixture } = await createRefund({
      label: "ledger-sweep",
      credited: true,
      providerRefundId: "REFUND-LEDGER-SWEEP",
    });
    provider.statuses.set("REFUND-LEDGER-SWEEP", "COMPLETED");
    await refundsService.reconcileUnresolvedRefunds(NOW);

    expect(await commissionsService.reconcileSellerLedger()).toMatchObject({ corrected: 0 });
    expect(await commissionsService.reconcileSellerLedger()).toMatchObject({ corrected: 0 });
    expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(1);
    expect((await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } })).balance.isZero()).toBe(true);
  });

  it("processes at most the configured batch and signals aged ambiguity", async () => {
    const refunds = [];
    for (let index = 0; index < 21; index += 1) {
      refunds.push(await createRefund({
        label: `batch-${index}`,
        providerRefundId: `REFUND-BATCH-${index}`,
        createdAt: OLD,
      }));
      provider.statuses.set(`REFUND-BATCH-${index}`, "PENDING");
    }

    expect(await refundsService.reconcileUnresolvedRefunds(NOW)).toMatchObject({
      scanned: 20,
      attempted: 20,
      stillPending: 20,
      operatorRequired: 20,
    });
    expect(await prisma.refund.count({ where: { id: { in: refunds.map(({ refund }) => refund.id) }, status: "PROCESSING" } })).toBe(21);
  });
});
