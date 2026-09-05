import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { createCheckoutGraph, createOrder, orderKey } from "./helpers/index.js";

vi.mock("../shared/utils/paypal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared/utils/paypal.js")>();
  return {
    ...actual,
    createPayPalOrder: vi.fn(),
    getPayPalApprovalLink: vi.fn(),
  };
});

import { createPayPalOrder, getPayPalApprovalLink } from "../shared/utils/paypal.js";
import { paymentsService } from "../modules/payments/payments.service.js";

function uniqueViolation(error: unknown) {
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect((error as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
}

describe("payment link idempotency (postgres)", () => {
  it("replays POST /payments without a second PayPal OrdersCreate", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("payment-replay")
    );

    vi.mocked(createPayPalOrder).mockResolvedValue({ id: "PAYPAL-REPLAY", links: [] } as never);
    vi.mocked(getPayPalApprovalLink).mockReturnValue("https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-REPLAY");

    const first = await paymentsService.createPaymentLink(fixture.customer.id, { orderId: order.id });
    const second = await paymentsService.createPaymentLink(fixture.customer.id, { orderId: order.id });

    const links = await prisma.paymentLink.findMany({ where: { orderId: order.id } });
    const stored = await prisma.order.findUnique({ where: { id: order.id } });

    expect(createPayPalOrder).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(links).toHaveLength(1);
    expect(links[0].status).toBe("COMPLETED");
    expect(links[0].paypalOrderId).toBe("PAYPAL-REPLAY");
    expect(stored?.paypalOrderId).toBe("PAYPAL-REPLAY");
  });

  it("creates one PayPal order for concurrent payment-link requests", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("payment-concurrent")
    );

    let createCalls = 0;
    vi.mocked(createPayPalOrder).mockImplementation(async () => {
      createCalls += 1;
      await Promise.resolve();
      return { id: "PAYPAL-CONCURRENT", links: [] };
    });
    vi.mocked(getPayPalApprovalLink).mockReturnValue(
      "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-CONCURRENT"
    );

    const results = await Promise.allSettled([
      paymentsService.createPaymentLink(fixture.customer.id, { orderId: order.id }),
      paymentsService.createPaymentLink(fixture.customer.id, { orderId: order.id }),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof paymentsService.createPaymentLink>>> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter((result) => result.status === "rejected");
    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    const links = await prisma.paymentLink.findMany({ where: { orderId: order.id } });

    expect(createCalls).toBe(1);
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    for (const result of fulfilled) {
      expect(result.value.paypalOrderId).toBe("PAYPAL-CONCURRENT");
    }
    for (const result of rejected) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: expect.objectContaining({
          statusCode: 409,
          message: expect.stringContaining("still in progress"),
        }),
      });
    }
    expect(links).toHaveLength(1);
    expect(links[0].paypalOrderId).toBe("PAYPAL-CONCURRENT");
    expect(stored?.paypalOrderId).toBe("PAYPAL-CONCURRENT");
  });

  it("releases the claim when OrdersCreate fails so a retry can create one PayPal order", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("payment-paypal-fail")
    );

    vi.mocked(createPayPalOrder)
      .mockRejectedValueOnce(new Error("PayPal unavailable"))
      .mockResolvedValueOnce({ id: "PAYPAL-RETRY", links: [] } as never);
    vi.mocked(getPayPalApprovalLink).mockReturnValue(
      "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-RETRY"
    );

    await expect(
      paymentsService.createPaymentLink(fixture.customer.id, { orderId: order.id })
    ).rejects.toThrow(/PayPal unavailable/);

    expect(await prisma.paymentLink.count({ where: { orderId: order.id } })).toBe(0);

    const retry = await paymentsService.createPaymentLink(fixture.customer.id, { orderId: order.id });

    expect(retry.paypalOrderId).toBe("PAYPAL-RETRY");
    expect(createPayPalOrder).toHaveBeenCalledTimes(2);
    expect(await prisma.paymentLink.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("enforces one PaymentLink row per order", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("payment-unique")
    );

    await prisma.paymentLink.create({
      data: { orderId: order.id, status: "IN_PROGRESS" },
    });

    let caught: unknown;
    try {
      await prisma.paymentLink.create({
        data: { orderId: order.id, status: "COMPLETED" },
      });
    } catch (error) {
      caught = error;
    }

    uniqueViolation(caught);
    expect(await prisma.paymentLink.count({ where: { orderId: order.id } })).toBe(1);
  });
});
