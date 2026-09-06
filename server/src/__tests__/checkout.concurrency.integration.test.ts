import { describe, expect, it } from "vitest";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

const CONCURRENT_BUYERS = 8;
const CONCURRENT_WEBHOOKS = 8;
const CONCURRENT_CONFIRMS = 8;

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

describe("checkout concurrency (postgres)", () => {
  it(`${DomainInvariant.LISTING_EXCLUSIVE_RESERVE}: eight concurrent creates reserve a unique listing once`, async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const extraBuyers = await Promise.all(
      Array.from({ length: CONCURRENT_BUYERS - 1 }, (_, index) =>
        createUser({ name: `Buyer ${index + 2}` })
      )
    );
    const buyers = [fixture.customer, ...extraBuyers];

    const results = await Promise.allSettled(
      buyers.map((buyer, index) => createOrder(buyer.id, [listingId], orderKey(`n-buyer-${index}`)))
    );

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ordersService.create>>> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(CONCURRENT_BUYERS - 1);
    for (const result of rejected) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining("not available"),
        }),
      });
    }

    const winnerId = fulfilled[0].value.id;
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const orders = await prisma.order.findMany();
    const orderItems = await prisma.orderItem.findMany({ where: { listingId } });
    const reservedListings = await prisma.listing.findMany({
      where: { id: listingId, status: "RESERVED" },
    });
    const keys = await prisma.orderIdempotencyKey.findMany();
    const txns = await prisma.sellerTransaction.findMany();

    expect(listing?.status).toBe("RESERVED");
    expect(listing?.reservedByOrderId).toBe(winnerId);
    expect(reservedListings).toHaveLength(1);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.id).toBe(winnerId);
    expect(orderItems).toHaveLength(1);
    expect(orderItems[0]?.orderId).toBe(winnerId);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.orderId).toBe(winnerId);
    expect(keys[0]?.status).toBe("COMPLETED");
    expect(txns).toHaveLength(0);
  });

  it(`${DomainInvariant.PAYMENT_WEBHOOK_IDEMPOTENT}: concurrent duplicate capture webhooks sell once`, async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(fixture.customer.id, [listingId], orderKey("webhook-winner"));
    const payload = captureEvent(`WH-${listingId}-checkout-concurrent`, order.id);

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_WEBHOOKS }, () => paymentsService.handleWebhook(payload))
    );

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    const events = await prisma.paymentWebhookEvent.findMany({
      where: { externalEventId: payload.id },
    });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(listing?.status).toBe("SOLD");
    expect(paid?.paymentStatus).toBe("PAID");
    expect(paid?.status).toBe("CONFIRMED");
    expect(txns).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("PROCESSED");
    expect(seller?.balance.toString()).toBe("90");
  });

  it(`${DomainInvariant.SELLER_TXN_UNIQUE}: concurrent confirmPayment claims PAID once`, async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(
      fixture.customer.id,
      [listingId],
      orderKey("confirm-concurrent")
    );

    const unpaid = await prisma.order.findUnique({ where: { id: created.id } });
    expect(unpaid?.paymentStatus).toBe("PENDING");
    expect(unpaid?.status).toBe("PENDING");

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_CONFIRMS }, () => paymentsService.confirmPayment(created.id))
    );

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const order = await prisma.order.findUnique({ where: { id: created.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(listing?.status).toBe("SOLD");
    expect(order?.paymentStatus).toBe("PAID");
    expect(order?.status).toBe("CONFIRMED");
    expect(txns).toHaveLength(1);
    expect(seller?.balance.toString()).toBe("90");
  });
});
