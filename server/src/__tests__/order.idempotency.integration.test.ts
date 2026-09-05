import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";

type Fixture = {
  customerAId: string;
  customerBId: string;
  sellerUserId: string;
  sellerId: string;
  productId: string;
  listingIds: string[];
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

async function createFixture(listingCount = 4): Promise<Fixture> {
  const suffix = randomUUID();
  const customerA = await prisma.user.create({
    data: {
      name: "Buyer A",
      email: `buyer-a-${suffix}@test.local`,
      password: "hash",
      role: "CUSTOMER",
    },
  });
  const customerB = await prisma.user.create({
    data: {
      name: "Buyer B",
      email: `buyer-b-${suffix}@test.local`,
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
  const listingIds: string[] = [];
  for (let index = 0; index < listingCount; index += 1) {
    const listing = await prisma.listing.create({
      data: {
        productId: product.id,
        sellerId: seller.id,
        floatValue: new Prisma.Decimal(`0.${15 + index}`),
        price: new Prisma.Decimal(`${100 + index}.00`),
        status: "ACTIVE",
      },
    });
    listingIds.push(listing.id);
  }

  return {
    customerAId: customerA.id,
    customerBId: customerB.id,
    sellerUserId: sellerUser.id,
    sellerId: seller.id,
    productId: product.id,
    listingIds,
  };
}

async function destroyFixture(fixture: Fixture) {
  const customerIds = [fixture.customerAId, fixture.customerBId];
  const orders = await prisma.order.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  });
  await prisma.paymentWebhookEvent.deleteMany({
    where: { orderId: { in: orders.map((order) => order.id) } },
  });
  await prisma.sellerTransaction.deleteMany({
    where: { sellerId: fixture.sellerId },
  });
  await prisma.orderItem.deleteMany({
    where: { listingId: { in: fixture.listingIds } },
  });
  await prisma.orderIdempotencyKey.deleteMany({
    where: { customerId: { in: customerIds } },
  });
  await prisma.order.deleteMany({
    where: { customerId: { in: customerIds } },
  });
  await prisma.listing.deleteMany({
    where: { id: { in: fixture.listingIds } },
  });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.seller.deleteMany({ where: { id: fixture.sellerId } });
  await prisma.user.deleteMany({
    where: { id: { in: [...customerIds, fixture.sellerUserId] } },
  });
}

function orderKey(label: string) {
  return `idem-${label}-${randomUUID()}`;
}

async function createOrder(customerId: string, listingIds: string[], key: string) {
  return ordersService.create(
    customerId,
    { items: listingIds.map((listingId) => ({ listingId })) },
    key
  );
}

describe.skipIf(!databaseAvailable)("order creation idempotency (postgres)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the original order for a basic replay with the same key and listing set", async () => {
    const fixture = await createFixture();
    const key = orderKey("basic-replay");
    try {
      const first = await createOrder(fixture.customerAId, [fixture.listingIds[0]], key);
      const second = await createOrder(fixture.customerAId, [fixture.listingIds[0]], key);

      const orders = await prisma.order.findMany({
        where: { customerId: fixture.customerAId },
      });
      const records = await prisma.orderIdempotencyKey.findMany({
        where: { customerId: fixture.customerAId, key },
      });
      const orderItems = await prisma.orderItem.findMany({
        where: { listingId: fixture.listingIds[0] },
      });
      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingIds[0] } });

      expect(second.id).toBe(first.id);
      expect(orders).toHaveLength(1);
      expect(records).toHaveLength(1);
      expect(orderItems).toHaveLength(1);
      expect(listing?.status).toBe("RESERVED");
      expect(listing?.reservedByOrderId).toBe(first.id);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("treats equivalent listing ordering as the same canonical request", async () => {
    const fixture = await createFixture();
    const key = orderKey("canonical-order");
    const listingSet = [fixture.listingIds[0], fixture.listingIds[1]];
    try {
      const first = await createOrder(fixture.customerAId, listingSet, key);
      const second = await createOrder(fixture.customerAId, [...listingSet].reverse(), key);

      const orders = await prisma.order.findMany({
        where: { customerId: fixture.customerAId },
      });
      const orderItems = await prisma.orderItem.findMany({
        where: { listingId: { in: listingSet } },
      });
      const reservedListings = await prisma.listing.findMany({
        where: { id: { in: listingSet }, status: "RESERVED" },
      });

      expect(second.id).toBe(first.id);
      expect(orders).toHaveLength(1);
      expect(orderItems).toHaveLength(2);
      expect(reservedListings).toHaveLength(2);
      expect(reservedListings.every((listing) => listing.reservedByOrderId === first.id)).toBe(true);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("rejects conflicting reuse of an idempotency key without reserving another listing", async () => {
    const fixture = await createFixture();
    const key = orderKey("conflict");
    try {
      const created = await createOrder(fixture.customerAId, [fixture.listingIds[0]], key);

      await expect(
        createOrder(fixture.customerAId, [fixture.listingIds[1]], key)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("different order request"),
      });

      const orders = await prisma.order.findMany({
        where: { customerId: fixture.customerAId },
      });
      const secondListing = await prisma.listing.findUnique({
        where: { id: fixture.listingIds[1] },
      });
      const record = await prisma.orderIdempotencyKey.findUnique({
        where: { customerId_key: { customerId: fixture.customerAId, key } },
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

  it("scopes the same idempotency key independently per customer", async () => {
    const fixture = await createFixture();
    const key = orderKey("user-isolation");
    try {
      const customerAOrder = await createOrder(fixture.customerAId, [fixture.listingIds[0]], key);
      const customerBOrder = await createOrder(fixture.customerBId, [fixture.listingIds[1]], key);

      const records = await prisma.orderIdempotencyKey.findMany({
        where: { key },
        orderBy: { customerId: "asc" },
      });
      const customerBStoredOrder = await prisma.order.findUnique({
        where: { id: customerBOrder.id },
      });

      expect(customerBOrder.id).not.toBe(customerAOrder.id);
      expect(customerBOrder.customerId).toBe(fixture.customerBId);
      expect(customerBStoredOrder?.customerId).toBe(fixture.customerBId);
      expect(records).toHaveLength(2);
      expect(records.map((record) => record.customerId).sort()).toEqual(
        [fixture.customerAId, fixture.customerBId].sort()
      );
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("rolls back the idempotency row when order creation fails after the row is created", async () => {
    const fixture = await createFixture();
    const key = orderKey("rollback");
    try {
      await prisma.listing.update({
        where: { id: fixture.listingIds[0] },
        data: { tradeLockUntil: new Date(Date.now() + 60_000) },
      });

      await expect(
        createOrder(fixture.customerAId, [fixture.listingIds[0]], key)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("trade locked"),
      });

      const recordsAfterFailure = await prisma.orderIdempotencyKey.findMany({
        where: { customerId: fixture.customerAId, key },
      });
      const ordersAfterFailure = await prisma.order.findMany({
        where: { customerId: fixture.customerAId },
      });
      const orderItemsAfterFailure = await prisma.orderItem.findMany({
        where: { listingId: fixture.listingIds[0] },
      });
      const listingAfterFailure = await prisma.listing.findUnique({
        where: { id: fixture.listingIds[0] },
      });

      expect(recordsAfterFailure).toHaveLength(0);
      expect(ordersAfterFailure).toHaveLength(0);
      expect(orderItemsAfterFailure).toHaveLength(0);
      expect(listingAfterFailure?.status).toBe("ACTIVE");
      expect(listingAfterFailure?.reservedByOrderId).toBeNull();

      await prisma.listing.update({
        where: { id: fixture.listingIds[0] },
        data: { tradeLockUntil: null },
      });

      const retry = await createOrder(fixture.customerAId, [fixture.listingIds[0]], key);
      const recordsAfterRetry = await prisma.orderIdempotencyKey.findMany({
        where: { customerId: fixture.customerAId, key },
      });
      const listingAfterRetry = await prisma.listing.findUnique({
        where: { id: fixture.listingIds[0] },
      });

      expect(recordsAfterRetry).toHaveLength(1);
      expect(recordsAfterRetry[0].orderId).toBe(retry.id);
      expect(listingAfterRetry?.status).toBe("RESERVED");
      expect(listingAfterRetry?.reservedByOrderId).toBe(retry.id);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("creates one business effect for concurrent retries with the same idempotency key", async () => {
    const fixture = await createFixture();
    const key = orderKey("concurrent-retry");
    try {
      const results = await Promise.allSettled([
        createOrder(fixture.customerAId, [fixture.listingIds[0]], key),
        createOrder(fixture.customerAId, [fixture.listingIds[0]], key),
      ]);

      expect(results.every((result) => result.status === "fulfilled")).toBe(true);
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ordersService.create>>> =>
          result.status === "fulfilled"
      );

      const orders = await prisma.order.findMany({
        where: { customerId: fixture.customerAId },
      });
      const records = await prisma.orderIdempotencyKey.findMany({
        where: { customerId: fixture.customerAId, key },
      });
      const orderItems = await prisma.orderItem.findMany({
        where: { listingId: fixture.listingIds[0] },
      });
      const reservedListings = await prisma.listing.findMany({
        where: { id: fixture.listingIds[0], status: "RESERVED" },
      });

      expect(fulfilled).toHaveLength(2);
      expect(fulfilled[0].value.id).toBe(fulfilled[1].value.id);
      expect(orders).toHaveLength(1);
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe("COMPLETED");
      expect(records[0].orderId).toBe(fulfilled[0].value.id);
      expect(orderItems).toHaveLength(1);
      expect(reservedListings).toHaveLength(1);
      expect(reservedListings[0].reservedByOrderId).toBe(fulfilled[0].value.id);
    } finally {
      await destroyFixture(fixture);
    }
  });

  it("preserves reservation concurrency for different business requests racing for one listing", async () => {
    const fixture = await createFixture();
    try {
      const results = await Promise.allSettled([
        createOrder(fixture.customerAId, [fixture.listingIds[0]], orderKey("race-a")),
        createOrder(fixture.customerBId, [fixture.listingIds[0]], orderKey("race-b")),
      ]);

      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ordersService.create>>> =>
          result.status === "fulfilled"
      );
      const rejected = results.filter((result) => result.status === "rejected");
      const orders = await prisma.order.findMany({
        where: { items: { some: { listingId: fixture.listingIds[0] } } },
      });
      const orderItems = await prisma.orderItem.findMany({
        where: { listingId: fixture.listingIds[0] },
      });
      const records = await prisma.orderIdempotencyKey.findMany({
        where: { customerId: { in: [fixture.customerAId, fixture.customerBId] } },
      });
      const listing = await prisma.listing.findUnique({ where: { id: fixture.listingIds[0] } });

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(orders).toHaveLength(1);
      expect(orderItems).toHaveLength(1);
      expect(records).toHaveLength(1);
      expect(listing?.status).toBe("RESERVED");
      expect(listing?.reservedByOrderId).toBe(fulfilled[0].value.id);
    } finally {
      await destroyFixture(fixture);
    }
  });
});
