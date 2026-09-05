import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../shared/database/index.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { AppError } from "../shared/errors/AppError.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

function captureEvent(eventId: string, localOrderId: string, paypalOrderId = `PAYPAL-${localOrderId}`) {
  return {
    id: eventId,
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: `CAPTURE-${eventId}`,
      purchase_units: [{ reference_id: localOrderId }],
      supplementary_data: { related_ids: { order_id: paypalOrderId } },
    },
  };
}

function approvedEvent(eventId: string, localOrderId: string, paypalOrderId = `PAYPAL-${localOrderId}`) {
  return {
    id: eventId,
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: {
      id: paypalOrderId,
      purchase_units: [{ reference_id: localOrderId }],
    },
  };
}

describe("PayPal webhook reliability (postgres)", () => {
  it("persists a unique external event identity", async () => {
    const eventId = `WH-${randomUUID()}`;
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: "PAYPAL",
        externalEventId: eventId,
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        status: "PROCESSED",
      },
    });

    await expect(
      prisma.paymentWebhookEvent.create({
        data: {
          provider: "PAYPAL",
          externalEventId: eventId,
          eventType: "PAYMENT.CAPTURE.COMPLETED",
          status: "RECEIVED",
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("processes a capture webhook once and ignores sequential duplicates", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("approved")
    );
    const eventId = `WH-${fixture.listings[0].id}-dup`;
    const payload = captureEvent(eventId, order.id);

    await paymentsService.handleWebhook(payload);
    await paymentsService.handleWebhook(payload);
    await paymentsService.handleWebhook(payload);

    const listing = await prisma.listing.findUnique({ where: { id: fixture.listings[0].id } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    const events = await prisma.paymentWebhookEvent.findMany({
      where: { externalEventId: eventId },
    });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(listing?.status).toBe("SOLD");
    expect(paid?.paymentStatus).toBe("PAID");
    expect(txns).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("PROCESSED");
    expect(seller?.balance.toString()).toBe("90");
  });

  it("treats concurrent identical webhooks as a single sale (case A)", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("capture")
    );
    const payload = captureEvent(`WH-${fixture.listings[0].id}-concurrent`, order.id);

    const results = await Promise.allSettled([
      paymentsService.handleWebhook(payload),
      paymentsService.handleWebhook(payload),
      paymentsService.handleWebhook(payload),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const listing = await prisma.listing.findUnique({ where: { id: fixture.listings[0].id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    const events = await prisma.paymentWebhookEvent.findMany({
      where: { externalEventId: payload.id },
    });

    expect(listing?.status).toBe("SOLD");
    expect(txns).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it("keeps a valid final state when APPROVED and COMPLETED arrive together (case B)", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("duplicate")
    );

    const results = await Promise.allSettled([
      paymentsService.handleWebhook(approvedEvent(`WH-${fixture.listings[0].id}-approved`, order.id)),
      paymentsService.handleWebhook(captureEvent(`WH-${fixture.listings[0].id}-capture`, order.id)),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const listing = await prisma.listing.findUnique({ where: { id: fixture.listings[0].id } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });

    expect(listing?.status).toBe("SOLD");
    expect(paid?.paymentStatus).toBe("PAID");
    expect(txns).toHaveLength(1);
  });

  it("does not sell from CHECKOUT.ORDER.APPROVED even if it arrives after capture", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("concurrent")
    );
    await paymentsService.handleWebhook(captureEvent(`WH-${fixture.listings[0].id}-first-capture`, order.id));
    await paymentsService.handleWebhook(approvedEvent(`WH-${fixture.listings[0].id}-late-approved`, order.id));

    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    expect(txns).toHaveLength(1);
  });

  it("sells only after capture when APPROVED arrives first", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(fixture.customer.id, [listingId], orderKey("ignored"));
    await paymentsService.handleWebhook(approvedEvent(`WH-${listingId}-approved-first`, order.id));

    const afterApproved = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(afterApproved?.status).toBe("RESERVED");

    await paymentsService.handleWebhook(captureEvent(`WH-${listingId}-capture-second`, order.id));

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    expect(listing?.status).toBe("SOLD");
    expect(txns).toHaveLength(1);
  });

  it("is a no-op when the order is already PAID (case D)", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("expired")
    );
    await paymentsService.confirmPayment(order.id);
    await paymentsService.handleWebhook(captureEvent(`WH-${fixture.listings[0].id}-after-paid`, order.id));

    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    const listing = await prisma.listing.findUnique({ where: { id: fixture.listings[0].id } });
    expect(txns).toHaveLength(1);
    expect(listing?.status).toBe("SOLD");
  });

  it("does not sell an expired reservation from a capture webhook", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(fixture.customer.id, [listingId], orderKey("no-duplicate"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });

    await paymentsService.handleWebhook(captureEvent(`WH-${listingId}-expired`, order.id));

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    const event = await prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: "PAYPAL",
          externalEventId: `WH-${listingId}-expired`,
        },
      },
    });

    expect(listing?.status).toBe("RESERVED");
    expect(paid?.paymentStatus).toBe("PENDING");
    expect(txns).toHaveLength(0);
    expect(event?.status).toBe("FAILED");
    expect(event?.failureReason).toBe("reservation_expired");
  });

  it("has a single valid winner when capture webhook races expiration (case C)", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(fixture.customer.id, [listingId], orderKey("approved-first"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    await Promise.allSettled([
      paymentsService.handleWebhook(captureEvent(`WH-${listingId}-race-valid`, order.id)),
      listingsService.expireReservations(),
    ]);
    await listingsService.expireReservations();

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });

    expect(listing?.status).toBe("SOLD");
    expect(paid?.paymentStatus).toBe("PAID");
    expect(txns).toHaveLength(1);
  });

  it("lets expiration win a concurrent capture when the reservation already elapsed", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(fixture.customer.id, [listingId], orderKey("unknown-first"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });

    await Promise.allSettled([
      paymentsService.handleWebhook(captureEvent(`WH-${listingId}-race-expired`, order.id)),
      listingsService.expireReservations(),
    ]);
    await listingsService.expireReservations();

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });

    expect(listing?.status).toBe("ACTIVE");
    expect(paid?.paymentStatus).toBe("PENDING");
    expect(paid?.status).toBe("CANCELLED");
    expect(txns).toHaveLength(0);
  });

  it("cannot sell a listing that returned to ACTIVE and was reserved by another order", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const otherBuyer = await createUser({ name: "Buyer 2" });
    const orderA = await createOrder(fixture.customer.id, [listingId], orderKey("stale-a"));

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        status: "ACTIVE",
        reservedAt: null,
        reservationExpiresAt: null,
        reservedByOrderId: null,
      },
    });

    const orderB = await createOrder(otherBuyer.id, [listingId], orderKey("stale-b"));
    await paymentsService.handleWebhook(captureEvent(`WH-${listingId}-stale-a`, orderA.id));

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const stale = await prisma.order.findUnique({ where: { id: orderA.id } });
    const fresh = await prisma.order.findUnique({ where: { id: orderB.id } });
    const txnsA = await prisma.sellerTransaction.findMany({ where: { orderId: orderA.id } });
    const txnsB = await prisma.sellerTransaction.findMany({ where: { orderId: orderB.id } });

    expect(listing?.status).toBe("RESERVED");
    expect(listing?.reservedByOrderId).toBe(orderB.id);
    expect(stale?.paymentStatus).toBe("PENDING");
    expect(fresh?.paymentStatus).toBe("PENDING");
    expect(txnsA).toHaveLength(0);
    expect(txnsB).toHaveLength(0);
  });

  it("rolls back the payment claim when the listing cannot be sold", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(fixture.customer.id, [listingId], orderKey("rollback"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "CANCELED", reservedByOrderId: null },
    });

    await expect(paymentsService.confirmPayment(order.id)).rejects.toBeInstanceOf(AppError);

    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(paid?.paymentStatus).toBe("PENDING");
    expect(paid?.status).toBe("PENDING");
    expect(txns).toHaveLength(0);
    expect(seller?.balance.toString()).toBe("0");
  });

  it("retries a capture after a crash left the event RECEIVED", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("crash"));
    const eventId = `WH-${fixture.listings[0].id}-crash`;
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: "PAYPAL",
        externalEventId: eventId,
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        status: "RECEIVED",
        orderId: order.id,
      },
    });

    await paymentsService.handleWebhook(captureEvent(eventId, order.id));

    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    const event = await prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_externalEventId: { provider: "PAYPAL", externalEventId: eventId },
      },
    });

    expect(paid?.paymentStatus).toBe("PAID");
    expect(txns).toHaveLength(1);
    expect(event?.status).toBe("PROCESSED");
  });
});
