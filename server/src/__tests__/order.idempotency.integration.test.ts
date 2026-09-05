import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";

type Fixture = {
  customerId: string;
  sellerUserId: string;
  sellerId: string;
  productId: string;
  listingId: string;
  secondListingId: string;
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
      skinName: `Idempotency ${suffix}`,
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
  const secondListing = await prisma.listing.create({
    data: {
      productId: product.id,
      sellerId: seller.id,
      floatValue: new Prisma.Decimal("0.16"),
      price: new Prisma.Decimal("120.00"),
      status: "ACTIVE",
    },
  });

  return {
    customerId: customer.id,
    sellerUserId: sellerUser.id,
    sellerId: seller.id,
    productId: product.id,
    listingId: listing.id,
    secondListingId: secondListing.id,
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
  await prisma.orderItem.deleteMany({
    where: { listingId: { in: [fixture.listingId, fixture.secondListingId] } },
  });
  await prisma.order.deleteMany({
    where: { customerId: fixture.customerId },
  });
  await prisma.listing.deleteMany({
    where: { id: { in: [fixture.listingId, fixture.secondListingId] } },
  });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.seller.deleteMany({ where: { id: fixture.sellerId } });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.customerId, fixture.sellerUserId] } },
  });
}

describe.skipIf(!databaseAvailable)("order creation idempotency (postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates one order for concurrent requests with the same idempotency key", async () => {
    const fixture = await createFixture();
    const key = `idem-${randomUUID()}`;
    try {
      const results = await Promise.allSettled([
        ordersService.create(
          fixture.customerId,
          { items: [{ listingId: fixture.listingId }] },
          key
        ),
        ordersService.create(
          fixture.customerId,
          { items: [{ listingId: fixture.listingId }] },
          key
        ),
      ]);

      expect(results.every((result) => result.status === "fulfilled")).toBe(true);
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ordersService.create>>> =>
          result.status === "fulfilled"
      );
      expect(fulfilled[0].value.id).toBe(fulfilled[1].value.id);

      const orders = await prisma.order.findMany({
        where: { customerId: fixture.customerId },
      });
      const records = await prisma.orderIdempotencyKey.findMany({
        where: { customerId: fixture.customerId, key },
      });
      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });

      expect(orders).toHaveLength(1);
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe("COMPLETED");
      expect(records[0].orderId).toBe(fulfilled[0].value.id);
      expect(listing?.reservedByOrderId).toBe(fulfilled[0].value.id);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("rejects conflicting reuse of an idempotency key without reserving another listing", async () => {
    const fixture = await createFixture();
    const key = `idem-${randomUUID()}`;
    try {
      const created = await ordersService.create(
        fixture.customerId,
        { items: [{ listingId: fixture.listingId }] },
        key
      );

      await expect(
        ordersService.create(
          fixture.customerId,
          { items: [{ listingId: fixture.secondListingId }] },
          key
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("different order request"),
      });

      const orders = await prisma.order.findMany({
        where: { customerId: fixture.customerId },
      });
      const secondListing = await prisma.listing.findUnique({
        where: { id: fixture.secondListingId },
      });
      const record = await prisma.orderIdempotencyKey.findUnique({
        where: { customerId_key: { customerId: fixture.customerId, key } },
      });

      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe(created.id);
      expect(secondListing?.status).toBe("ACTIVE");
      expect(secondListing?.reservedByOrderId).toBeNull();
      expect(record?.orderId).toBe(created.id);
    } finally {
      await destroyFixture(fixture);
    }
  });
});
