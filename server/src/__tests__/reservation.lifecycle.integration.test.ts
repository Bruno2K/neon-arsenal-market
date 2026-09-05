import { randomUUID } from "node:crypto";
import { describe, it, expect, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { listingsService } from "../modules/listings/listings.service.js";

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
      skinName: `Test ${suffix}`,
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
    where: { orderId: { in: orders.map((order) => order.id) } },
  });
  await prisma.sellerTransaction.deleteMany({
    where: { sellerId: fixture.sellerId },
  });
  await prisma.orderIdempotency.deleteMany({
    where: {
      OR: [
        { userId: fixture.customerId },
        { orderId: { in: orders.map((order) => order.id) } },
      ],
    },
  });
  await prisma.orderItem.deleteMany({
    where: { listingId: fixture.listingId },
  });
  await prisma.order.deleteMany({
    where: { customerId: fixture.customerId },
  });
  await prisma.listing.deleteMany({ where: { id: fixture.listingId } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.seller.deleteMany({ where: { id: fixture.sellerId } });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.customerId, fixture.sellerUserId] } },
  });
}

describe.skipIf(!databaseAvailable)("reservation lifecycle (postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("ACTIVE → RESERVED → SOLD persists reservation timestamps", async () => {
    const fixture = await createFixture();
    try {
      const before = Date.now();
      const created = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      const reserved = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      expect(reserved?.status).toBe("RESERVED");
      expect(reserved?.reservedByOrderId).toBe(created.id);
      expect(reserved?.reservedAt).toBeInstanceOf(Date);
      expect(reserved?.reservationExpiresAt).toBeInstanceOf(Date);
      expect(reserved!.reservationExpiresAt!.getTime()).toBeGreaterThan(before);

      await paymentsService.confirmPayment(created.id);

      const sold = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const order = await prisma.order.findUnique({ where: { id: created.id } });
      expect(sold?.status).toBe("SOLD");
      expect(order?.paymentStatus).toBe("PAID");
      expect(order?.status).toBe("CONFIRMED");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("allows only one concurrent buyer to reserve a listing", async () => {
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
      const results = await Promise.allSettled([
        ordersService.create(fixture.customerId, { items: [{ listingId: fixture.listingId }] }, randomUUID()),
        ordersService.create(otherBuyer.id, { items: [{ listingId: fixture.listingId }] }, randomUUID()),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      expect(listing?.status).toBe("RESERVED");
      const orders = await prisma.order.findMany({
        where: { items: { some: { listingId: fixture.listingId } } },
      });
      expect(orders).toHaveLength(1);
    } finally {
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

  it("returns RESERVED listings to ACTIVE only after expiration", async () => {
    const fixture = await createFixture();
    try {
      const created = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());

      await listingsService.expireReservations();
      const reserved = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      expect(reserved?.status).toBe("RESERVED");

      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });

      await listingsService.expireReservations();

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const order = await prisma.order.findUnique({ where: { id: created.id } });
      expect(listing?.status).toBe("ACTIVE");
      expect(listing?.reservedAt).toBeNull();
      expect(listing?.reservationExpiresAt).toBeNull();
      expect(listing?.reservedByOrderId).toBeNull();
      expect(order?.status).toBe("CANCELLED");
      expect(order?.paymentStatus).toBe("PENDING");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("does not expire a SOLD listing", async () => {
    const fixture = await createFixture();
    try {
      const created = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await paymentsService.confirmPayment(created.id);
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
      });

      await listingsService.expireReservations();

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      expect(listing?.status).toBe("SOLD");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("rejects payment confirmation after the reservation has expired", async () => {
    const fixture = await createFixture();
    try {
      const created = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });

      await expect(paymentsService.confirmPayment(created.id)).rejects.toMatchObject({
        statusCode: 409,
      });

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const order = await prisma.order.findUnique({ where: { id: created.id } });
      expect(listing?.status).toBe("RESERVED");
      expect(order?.paymentStatus).toBe("PENDING");
      expect(order?.status).toBe("PENDING");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("lets payment confirmation win when the reservation is still valid", async () => {
    const fixture = await createFixture();
    try {
      const created = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      // Far-future TTL: expire's WHERE reservationExpiresAt <= now cannot match.
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });

      const results = await Promise.allSettled([
        paymentsService.confirmPayment(created.id),
        listingsService.expireReservations(),
      ]);
      await listingsService.expireReservations();

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const order = await prisma.order.findUnique({ where: { id: created.id } });

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("fulfilled");
      expect(listing?.status).toBe("SOLD");
      expect(order?.paymentStatus).toBe("PAID");
      expect(order?.status).toBe("CONFIRMED");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("lets expiration win when the reservation has already elapsed", async () => {
    const fixture = await createFixture();
    try {
      const created = await ordersService.create(fixture.customerId, {
        items: [{ listingId: fixture.listingId }],
      }, randomUUID());
      // Past TTL: payment's WHERE reservationExpiresAt > now cannot match.
      await prisma.listing.update({
        where: { id: fixture.listingId },
        data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });

      const results = await Promise.allSettled([
        paymentsService.confirmPayment(created.id),
        listingsService.expireReservations(),
      ]);
      await listingsService.expireReservations();

      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const order = await prisma.order.findUnique({ where: { id: created.id } });

      expect(results).toHaveLength(2);
      expect(listing?.status).toBe("ACTIVE");
      expect(listing?.reservedAt).toBeNull();
      expect(listing?.reservationExpiresAt).toBeNull();
      expect(order?.paymentStatus).toBe("PENDING");
      expect(order?.status).toBe("CANCELLED");
    } finally {
      await destroyFixture(fixture);
    }
  });
});
