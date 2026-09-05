import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { dispatchOutboxEvents } from "../shared/outbox/outbox.dispatcher.js";
import { OutboxEventType } from "../shared/outbox/outbox.types.js";
import { OUTBOX_CLAIM_TIMEOUT_MS, OUTBOX_MAX_ATTEMPTS } from "../shared/config/outbox.js";
import { createCheckoutGraph, createOrder, orderKey } from "./helpers/index.js";

async function confirmFreshOrder() {
  const fixture = await createCheckoutGraph();
  const created = await createOrder(
    fixture.customer.id,
    [fixture.listings[0].id],
    orderKey("outbox-confirm")
  );
  await paymentsService.confirmPayment(created.id);
  return { fixture, orderId: created.id };
}

describe("transactional outbox (postgres)", () => {
  it("inserts PAYMENT_CONFIRMED and ORDER_CONFIRMED in the same transaction as confirm", async () => {
    const { orderId } = await confirmFreshOrder();

    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: orderId },
      orderBy: { type: "asc" },
    });
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    expect(order?.paymentStatus).toBe("PAID");
    expect(order?.status).toBe("CONFIRMED");
    expect(events.map((event) => event.type).sort()).toEqual([
      OutboxEventType.ORDER_CONFIRMED,
      OutboxEventType.PAYMENT_CONFIRMED,
    ]);
    expect(events.every((event) => event.status === "PENDING")).toBe(true);
    expect(events.every((event) => event.attempts === 0)).toBe(true);
    for (const event of events) {
      const payload = event.payload as { orderId?: string };
      expect(payload.orderId).toBe(orderId);
    }
  });

  it("rolls back outbox rows when the payment claim cannot sell listings", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("outbox-rollback")
    );
    await prisma.listing.update({
      where: { id: fixture.listings[0].id },
      data: { reservationExpiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(paymentsService.confirmPayment(created.id)).rejects.toMatchObject({
      statusCode: 409,
    });

    const order = await prisma.order.findUnique({ where: { id: created.id } });
    expect(order?.paymentStatus).toBe("PENDING");
    expect(await prisma.outboxEvent.count({ where: { aggregateId: created.id } })).toBe(0);
  });

  it("does not insert a second pair on duplicate confirmPayment", async () => {
    const { orderId } = await confirmFreshOrder();
    await paymentsService.confirmPayment(orderId);
    await paymentsService.confirmPayment(orderId);

    expect(await prisma.outboxEvent.count({ where: { aggregateId: orderId } })).toBe(2);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: orderId, type: OutboxEventType.PAYMENT_CONFIRMED },
      })
    ).toBe(1);
  });

  it("rejects a duplicate (type, aggregateId) insert at PostgreSQL", async () => {
    const { orderId } = await confirmFreshOrder();

    let caught: unknown;
    try {
      await prisma.outboxEvent.create({
        data: {
          type: OutboxEventType.PAYMENT_CONFIRMED,
          aggregateId: orderId,
          payload: { orderId },
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
    expect(await prisma.outboxEvent.count({ where: { aggregateId: orderId } })).toBe(2);
  });

  it("publishes claimed rows once; a second sweep is a no-op", async () => {
    const { orderId } = await confirmFreshOrder();

    const first = await dispatchOutboxEvents();
    const second = await dispatchOutboxEvents();

    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: orderId } });
    expect(first.published).toBe(2);
    expect(second.published).toBe(0);
    expect(second.claimed).toBe(0);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.status === "PUBLISHED")).toBe(true);
    expect(events.every((event) => event.attempts === 1)).toBe(true);
  });

  it("retries a crash after claim by reclaiming stale PROCESSING rows", async () => {
    const { orderId } = await confirmFreshOrder();
    const staleAt = new Date(Date.now() - OUTBOX_CLAIM_TIMEOUT_MS - 1_000);
    await prisma.outboxEvent.updateMany({
      where: { aggregateId: orderId },
      data: { status: "PROCESSING", claimedAt: staleAt, attempts: 1 },
    });

    const result = await dispatchOutboxEvents();
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: orderId } });

    expect(result.published).toBe(2);
    expect(events.every((event) => event.status === "PUBLISHED")).toBe(true);
    expect(events.every((event) => event.attempts === 2)).toBe(true);
  });

  it("lets only one concurrent dispatcher claim each row", async () => {
    const { orderId } = await confirmFreshOrder();

    const results = await Promise.all([dispatchOutboxEvents(), dispatchOutboxEvents()]);
    const published = results.reduce((sum, result) => sum + result.published, 0);
    const claimed = results.reduce((sum, result) => sum + result.claimed, 0);
    const events = await prisma.outboxEvent.findMany({ where: { aggregateId: orderId } });

    expect(published).toBe(2);
    expect(claimed).toBe(2);
    expect(events.every((event) => event.status === "PUBLISHED")).toBe(true);
    expect(events.every((event) => event.attempts === 1)).toBe(true);
  });

  it("moves a row to FAILED after bounded retries", async () => {
    const { orderId } = await confirmFreshOrder();
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: orderId, type: OutboxEventType.ORDER_CONFIRMED },
    });
    await prisma.outboxEvent.updateMany({
      where: { aggregateId: orderId },
      data: { attempts: OUTBOX_MAX_ATTEMPTS - 1, status: "PENDING", availableAt: new Date() },
    });

    const result = await dispatchOutboxEvents({
      handle: async () => {
        throw new Error("forced handler failure");
      },
    });

    const event = await prisma.outboxEvent.findFirst({
      where: { aggregateId: orderId, type: OutboxEventType.PAYMENT_CONFIRMED },
    });
    expect(result.failed).toBe(1);
    expect(event?.status).toBe("FAILED");
    expect(event?.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
    expect(event?.lastError).toBe("forced handler failure");
  });
});
