import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { AppError } from "../shared/errors/AppError.js";

type Fixture = {
  customerId: string;
  sellerUserId: string;
  sellerId: string;
  productId: string;
  listingId: string;
};

const postgresConfigured = Boolean(process.env.DATABASE_URL?.startsWith("postgres"));

async function pingDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const databaseAvailable = postgresConfigured ? await pingDatabase() : false;
if (postgresConfigured && !databaseAvailable && process.env.CI) {
  throw new Error("DATABASE_URL is set in CI but PostgreSQL is unreachable");
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const customer = await prisma.user.create({
    data: {
      name: "Buyer",
      email: `buyer-${suffix}@test.local`,
      password: "hash",
      role: "CUSTOMER",
    },
  });
  const sellerUser = await prisma.user.create({
    data: {
      name: "Seller",
      email: `seller-${suffix}@test.local`,
      password: "hash",
      role: "SELLER",
    },
  });
  const seller = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      storeName: `Store ${suffix}`,
      isApproved: true,
      commissionRate: new Prisma.Decimal("0.1"),
    },
  });
  const product = await prisma.product.create({
    data: {
      game: "CS2",
      weapon: "AK-47",
      skinName: `PayPal ${suffix}`,
      rarity: "Classified",
      exterior: "Field-Tested",
    },
  });
  const listing = await prisma.listing.create({
    data: {
      productId: product.id,
      sellerId: seller.id,
      floatValue: new Prisma.Decimal("0.15"),
      price: new Prisma.Decimal("100.00"),
      status: "ACTIVE",
    },
  });

  return {
    customerId: customer.id,
    sellerUserId: sellerUser.id,
    sellerId: seller.id,
    productId: product.id,
    listingId: listing.id,
  };
}

async function destroyFixture(fixture: Fixture) {
  const orders = await prisma.order.findMany({
    where: { customerId: fixture.customerId },
    select: { id: true },
  });
  await prisma.paymentWebhookEvent.deleteMany({
    where: {
      OR: [
        { orderId: { in: orders.map((order) => order.id) } },
        { externalEventId: { startsWith: `WH-${fixture.listingId}` } },
      ],
    },
  });
  await prisma.sellerTransaction.deleteMany({ where: { sellerId: fixture.sellerId } });
  await prisma.orderIdempotency.deleteMany({
    where: {
      OR: [
        { userId: fixture.customerId },
        { orderId: { in: orders.map((order) => order.id) } },
      ],
    },
  });
  await prisma.orderItem.deleteMany({ where: { listingId: fixture.listingId } });
  await prisma.order.deleteMany({ where: { customerId: fixture.customerId } });
  await prisma.listing.deleteMany({ where: { id: fixture.listingId } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.seller.deleteMany({ where: { id: fixture.sellerId } });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.customerId, fixture.sellerUserId] } },
  });
}

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

describe.skipIf(!databaseAvailable)("PayPal webhook reliability (postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

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

    await prisma.paymentWebhookEvent.deleteMany({ where: { externalEventId: eventId } });
  });

  it("processes a capture webhook once and ignores sequential duplicates", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      const eventId = `WH-${fixture.listingId}-dup`;
      const payload = captureEvent(eventId, order.id);

      await paymentsService.handleWebhook(payload);
      await paymentsService.handleWebhook(payload);
      await paymentsService.handleWebhook(payload);

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const paid = await prisma.order.findUnique({ where: { id: order.id } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
      const events = await prisma.paymentWebhookEvent.findMany({
        where: { externalEventId: eventId },
      });
      const seller = await prisma.seller.findUnique({ where: { id: fixture.sellerId } });

      expect(listing?.status).toBe("SOLD");
      expect(paid?.paymentStatus).toBe("PAID");
      expect(txns).toHaveLength(1);
      expect(events).toHaveLength(1);
      expect(events[0]?.status).toBe("PROCESSED");
      expect(seller?.balance.toString()).toBe("90");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("treats concurrent identical webhooks as a single sale (case A)", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      const payload = captureEvent(`WH-${fixture.listingId}-concurrent`, order.id);

      const results = await Promise.allSettled([
        paymentsService.handleWebhook(payload),
        paymentsService.handleWebhook(payload),
        paymentsService.handleWebhook(payload),
      ]);

      expect(results.every((result) => result.status === "fulfilled")).toBe(true);

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
      const events = await prisma.paymentWebhookEvent.findMany({
        where: { externalEventId: payload.id },
      });

      expect(listing?.status).toBe("SOLD");
      expect(txns).toHaveLength(1);
      expect(events).toHaveLength(1);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("keeps a valid final state when APPROVED and COMPLETED arrive together (case B)", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());

      const results = await Promise.allSettled([
        paymentsService.handleWebhook(approvedEvent(`WH-${fixture.listingId}-approved`, order.id)),
        paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-capture`, order.id)),
      ]);

      expect(results.every((result) => result.status === "fulfilled")).toBe(true);

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const paid = await prisma.order.findUnique({ where: { id: order.id } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });

      expect(listing?.status).toBe("SOLD");
      expect(paid?.paymentStatus).toBe("PAID");
      expect(txns).toHaveLength(1);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("does not sell from CHECKOUT.ORDER.APPROVED even if it arrives after capture", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-first-capture`, order.id));
      await paymentsService.handleWebhook(approvedEvent(`WH-${fixture.listingId}-late-approved`, order.id));

      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
      expect(txns).toHaveLength(1);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("sells only after capture when APPROVED arrives first", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await paymentsService.handleWebhook(approvedEvent(`WH-${fixture.listingId}-approved-first`, order.id));

      const afterApproved = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      expect(afterApproved?.status).toBe("RESERVED");

      await paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-capture-second`, order.id));

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
      expect(listing?.status).toBe("SOLD");
      expect(txns).toHaveLength(1);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("is a no-op when the order is already PAID (case D)", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await paymentsService.confirmPayment(order.id);

      await paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-after-paid`, order.id));

      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      expect(txns).toHaveLength(1);
      expect(listing?.status).toBe("SOLD");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("does not sell an expired reservation from a capture webhook", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });

      await paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-expired`, order.id));

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const paid = await prisma.order.findUnique({ where: { id: order.id } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
      const event = await prisma.paymentWebhookEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider: "PAYPAL",
            externalEventId: `WH-${fixture.listingId}-expired`,
          },
        },
      });

      expect(listing?.status).toBe("RESERVED");
      expect(paid?.paymentStatus).toBe("PENDING");
      expect(txns).toHaveLength(0);
      expect(event?.status).toBe("FAILED");
      expect(event?.failureReason).toBe("reservation_expired");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("has a single valid winner when capture webhook races expiration (case C)", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });

      await Promise.allSettled([
        paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-race-valid`, order.id)),
        listingsService.expireReservations(),
      ]);
      await listingsService.expireReservations();

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const paid = await prisma.order.findUnique({ where: { id: order.id } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });

      expect(listing?.status).toBe("SOLD");
      expect(paid?.paymentStatus).toBe("PAID");
      expect(txns).toHaveLength(1);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("lets expiration win a concurrent capture when the reservation already elapsed", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });

      await Promise.allSettled([
        paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-race-expired`, order.id)),
        listingsService.expireReservations(),
      ]);
      await listingsService.expireReservations();

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const paid = await prisma.order.findUnique({ where: { id: order.id } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });

      expect(listing?.status).toBe("ACTIVE");
      expect(paid?.paymentStatus).toBe("PENDING");
      expect(paid?.status).toBe("CANCELLED");
      expect(txns).toHaveLength(0);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("cannot sell a listing that returned to ACTIVE and was reserved by another order", async () => {
    const fixture = await createFixture();
    const otherBuyer = await prisma.user.create({
      data: {
        name: "Buyer 2",
        email: `buyer2-${randomUUID()}@test.local`,
        password: "hash",
        role: "CUSTOMER",
      },
    });
    try {
      const orderA = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());

      // Crash window: listing released, unpaid order A not cancelled yet.
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: {
          status: "ACTIVE",
          reservedAt: null,
          reservationExpiresAt: null,
          reservedByOrderId: null,
        },
      });

      const orderB = await ordersService.create(otherBuyer.id, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());

      await paymentsService.handleWebhook(captureEvent(`WH-${fixture.listingId}-stale-a`, orderA.id));

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
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
    } finally {
      await prisma.paymentWebhookEvent.deleteMany({
        where: { externalEventId: `WH-${fixture.listingId}-stale-a` },
      });
      await prisma.orderIdempotency.deleteMany({
        where: { userId: { in: [fixture.customerId, otherBuyer.id] } },
      });
      await prisma.orderItem.deleteMany({ where: { listingId: fixture.listingId } });
      await prisma.order.deleteMany({
        where: { customerId: { in: [fixture.customerId, otherBuyer.id] } },
      });
      await destroyFixture(fixture);
      await prisma.user.deleteMany({ where: { id: otherBuyer.id } });
    }
  });

  it("rolls back the payment claim when the listing cannot be sold", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { status: "CANCELED", reservedByOrderId: null },
      });

      await expect(paymentsService.confirmPayment(order.id)).rejects.toBeInstanceOf(AppError);

      const paid = await prisma.order.findUnique({ where: { id: order.id } });
      const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
      const seller = await prisma.seller.findUnique({ where: { id: fixture.sellerId } });

      expect(paid?.paymentStatus).toBe("PENDING");
      expect(paid?.status).toBe("PENDING");
      expect(txns).toHaveLength(0);
      expect(seller?.balance.toString()).toBe("0");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("retries a capture after a crash left the event RECEIVED", async () => {
    const fixture = await createFixture();
    try {
      const order = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      const eventId = `WH-${fixture.listingId}-crash`;
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
    } finally {
      await destroyFixture(fixture);
    }
  });
});
