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
      email: `idem-buyer-${suffix}@test.local`,
      password: "hash",
      role: "CUSTOMER",
    },
  });
  const sellerUser = await prisma.user.create({
    data: {
      name: "Seller",
      email: `idem-seller-${suffix}@test.local`,
      password: "hash",
      role: "SELLER",
    },
  });
  const seller = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      storeName: `Idem Store ${suffix}`,
      isApproved: true,
      commissionRate: new Prisma.Decimal("0.1"),
    },
  });
  const product = await prisma.product.create({
    data: {
      game: "CS2",
      weapon: "AK-47",
      skinName: `Idem ${suffix}`,
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

async function createListing(fixture: Fixture) {
  return prisma.listing.create({
    data: {
      productId: fixture.productId,
      sellerId: fixture.sellerId,
      floatValue: new Prisma.Decimal("0.22"),
      price: new Prisma.Decimal("80.00"),
      status: "ACTIVE",
    },
  });
}

async function destroyFixture(fixture: Fixture, extraUserIds: string[] = [], extraListingIds: string[] = []) {
  const userIds = [fixture.customerId, ...extraUserIds];
  const listingIds = [fixture.listingId, ...extraListingIds];
  await prisma.orderIdempotency.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.orderItem.deleteMany({
    where: { listingId: { in: listingIds } },
  });
  await prisma.order.deleteMany({
    where: { customerId: { in: userIds } },
  });
  await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.seller.deleteMany({ where: { id: fixture.sellerId } });
  await prisma.user.deleteMany({
    where: { id: { in: [...userIds, fixture.sellerUserId] } },
  });
}

describe.skipIf(!databaseAvailable)("order creation idempotency (postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates exactly one order and replays the same result on retry", async () => {
    const fixture = await createFixture();
    const key = `retry-${randomUUID()}`;
    const input = { items: [{ listingId: fixture.listingId }] };
    try {
      const first = await ordersService.create(fixture.customerId, input, key);
      const second = await ordersService.create(fixture.customerId, input, key);

      expect(second.id).toBe(first.id);
      const orders = await prisma.order.findMany({ where: { customerId: fixture.customerId } });
      const items = await prisma.orderItem.findMany({ where: { listingId: fixture.listingId } });
      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const records = await prisma.orderIdempotency.findMany({
        where: { userId: fixture.customerId, key },
      });

      expect(orders).toHaveLength(1);
      expect(items).toHaveLength(1);
      expect(listing?.status).toBe("RESERVED");
      expect(listing?.reservedByOrderId).toBe(first.id);
      expect(records).toHaveLength(1);
      expect(records[0]?.status).toBe("COMPLETED");
      expect(records[0]?.orderId).toBe(first.id);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("rejects the same key with a different listing payload", async () => {
    const fixture = await createFixture();
    const extra = await createListing(fixture);
    const key = `mismatch-${randomUUID()}`;
    try {
      await ordersService.create(
        fixture.customerId,
        { items: [{ listingId: fixture.listingId }] },
        key
      );

      await expect(
        ordersService.create(fixture.customerId, { items: [{ listingId: extra.id }] }, key)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("different request"),
      });

      const orders = await prisma.order.findMany({ where: { customerId: fixture.customerId } });
      const extraListing = await prisma.listing.findUnique({ where: { id: extra.id } });
      expect(orders).toHaveLength(1);
      expect(extraListing?.status).toBe("ACTIVE");
    } finally {
      await destroyFixture(fixture, [], [extra.id]);
    }
  });

  it("treats a different key with the same payload as an independent request", async () => {
    const fixture = await createFixture();
    try {
      await ordersService.create(
        fixture.customerId,
        { items: [{ listingId: fixture.listingId }] },
        `key-a-${randomUUID()}`
      );

      await expect(
        ordersService.create(
          fixture.customerId,
          { items: [{ listingId: fixture.listingId }] },
          `key-b-${randomUUID()}`
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("not available"),
      });

      const orders = await prisma.order.findMany({ where: { customerId: fixture.customerId } });
      expect(orders).toHaveLength(1);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("scopes the same key independently per user", async () => {
    const fixture = await createFixture();
    const extra = await createListing(fixture);
    const otherBuyer = await prisma.user.create({
      data: {
        name: "Buyer 2",
        email: `idem-buyer2-${randomUUID()}@test.local`,
        password: "hash",
        role: "CUSTOMER",
      },
    });
    const sharedKey = `shared-${randomUUID()}`;
    try {
      const orderA = await ordersService.create(
        fixture.customerId,
        { items: [{ listingId: fixture.listingId }] },
        sharedKey
      );
      const orderB = await ordersService.create(
        otherBuyer.id,
        { items: [{ listingId: extra.id }] },
        sharedKey
      );

      expect(orderB.id).not.toBe(orderA.id);
      expect(orderB.customer.id).toBe(otherBuyer.id);

      const replayB = await ordersService.create(
        otherBuyer.id,
        { items: [{ listingId: extra.id }] },
        sharedKey
      );
      expect(replayB.id).toBe(orderB.id);
      expect(replayB.id).not.toBe(orderA.id);
    } finally {
      await destroyFixture(fixture, [otherBuyer.id], [extra.id]);
    }
  });

  it("does not let a second user replay another user's order", async () => {
    const fixture = await createFixture();
    const extra = await createListing(fixture);
    const otherBuyer = await prisma.user.create({
      data: {
        name: "Buyer 2",
        email: `idem-nosnoop-${randomUUID()}@test.local`,
        password: "hash",
        role: "CUSTOMER",
      },
    });
    const key = `private-${randomUUID()}`;
    try {
      const orderA = await ordersService.create(
        fixture.customerId,
        { items: [{ listingId: fixture.listingId }] },
        key
      );

      await expect(
        ordersService.create(otherBuyer.id, { items: [{ listingId: fixture.listingId }] }, key)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("not available"),
      });

      const orderB = await ordersService.create(
        otherBuyer.id,
        { items: [{ listingId: extra.id }] },
        key
      );
      expect(orderB.id).not.toBe(orderA.id);
    } finally {
      await destroyFixture(fixture, [otherBuyer.id], [extra.id]);
    }
  });

  it("allows only one order when identical requests race", async () => {
    const fixture = await createFixture();
    const key = `race-${randomUUID()}`;
    const input = { items: [{ listingId: fixture.listingId }] };
    try {
      const results = await Promise.allSettled([
        ordersService.create(fixture.customerId, input, key),
        ordersService.create(fixture.customerId, input, key),
        ordersService.create(fixture.customerId, input, key),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      expect(fulfilled).toHaveLength(3);
      expect(results.every((result) => result.status === "fulfilled")).toBe(true);

      const orderIds = new Set(
        fulfilled.map((result) => (result.status === "fulfilled" ? result.value.id : ""))
      );
      expect(orderIds.size).toBe(1);

      const orders = await prisma.order.findMany({ where: { customerId: fixture.customerId } });
      const items = await prisma.orderItem.findMany({ where: { listingId: fixture.listingId } });
      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingId } });
      const records = await prisma.orderIdempotency.findMany({
        where: { userId: fixture.customerId, key },
      });

      expect(orders).toHaveLength(1);
      expect(items).toHaveLength(1);
      expect(listing?.status).toBe("RESERVED");
      expect(listing?.reservedByOrderId).toBe(orders[0]?.id);
      expect(records).toHaveLength(1);
      expect(records[0]?.status).toBe("COMPLETED");
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("rolls back the idempotency claim when order creation fails", async () => {
    const fixture = await createFixture();
    const key = `rollback-${randomUUID()}`;
    try {
      await expect(
        ordersService.create(fixture.customerId, { items: [{ listingId: "missing-listing" }] }, key)
      ).rejects.toMatchObject({ statusCode: 404 });

      const leftover = await prisma.orderIdempotency.findUnique({
        where: { userId_key: { userId: fixture.customerId, key } },
      });
      expect(leftover).toBeNull();

      const created = await ordersService.create(
        fixture.customerId,
        { items: [{ listingId: fixture.listingId }] },
        key
      );
      expect(created.id).toBeDefined();
      const record = await prisma.orderIdempotency.findUnique({
        where: { userId_key: { userId: fixture.customerId, key } },
      });
      expect(record?.status).toBe("COMPLETED");
      expect(record?.orderId).toBe(created.id);
    } finally {
      await destroyFixture(fixture);
    }
  });
});
