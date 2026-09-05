import { describe, expect, it } from "vitest";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

describe("order creation idempotency (postgres)", () => {
  it("returns the original order for a basic replay with the same key and listing set", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const key = orderKey("basic-replay");

    const first = await createOrder(fixture.customer.id, [listingId], key);
    const second = await createOrder(fixture.customer.id, [listingId], key);

    const orders = await prisma.order.findMany({ where: { customerId: fixture.customer.id } });
    const records = await prisma.orderIdempotencyKey.findMany({
      where: { customerId: fixture.customer.id, key },
    });
    const orderItems = await prisma.orderItem.findMany({ where: { listingId } });
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    expect(second.id).toBe(first.id);
    expect(orders).toHaveLength(1);
    expect(records).toHaveLength(1);
    expect(orderItems).toHaveLength(1);
    expect(listing?.status).toBe("RESERVED");
    expect(listing?.reservedByOrderId).toBe(first.id);
  });

  it("treats equivalent listing ordering as the same canonical request", async () => {
    const fixture = await createCheckoutGraph(2);
    const listingSet = [fixture.listings[0].id, fixture.listings[1].id];
    const key = orderKey("canonical-order");

    const first = await createOrder(fixture.customer.id, listingSet, key);
    const second = await createOrder(fixture.customer.id, [...listingSet].reverse(), key);

    const orders = await prisma.order.findMany({ where: { customerId: fixture.customer.id } });
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
  });

  it("rejects conflicting reuse of an idempotency key without reserving another listing", async () => {
    const fixture = await createCheckoutGraph(2);
    const key = orderKey("conflict");
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], key);

    await expect(
      createOrder(fixture.customer.id, [fixture.listings[1].id], key)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("different order request"),
    });

    const orders = await prisma.order.findMany({ where: { customerId: fixture.customer.id } });
    const secondListing = await prisma.listing.findUnique({
      where: { id: fixture.listings[1].id },
    });
    const record = await prisma.orderIdempotencyKey.findUnique({
      where: { customerId_key: { customerId: fixture.customer.id, key } },
    });

    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(created.id);
    expect(secondListing?.status).toBe("ACTIVE");
    expect(secondListing?.reservedByOrderId).toBeNull();
    expect(record?.orderId).toBe(created.id);
  });

  it("scopes the same idempotency key independently per customer", async () => {
    const fixture = await createCheckoutGraph(2);
    const otherCustomer = await createUser({ name: "Buyer B" });
    const key = "ABC";

    const customerAOrder = await createOrder(fixture.customer.id, [fixture.listings[0].id], key);
    const customerBOrder = await createOrder(otherCustomer.id, [fixture.listings[1].id], key);

    const records = await prisma.orderIdempotencyKey.findMany({
      where: { key },
      orderBy: { customerId: "asc" },
    });

    expect(customerBOrder.id).not.toBe(customerAOrder.id);
    expect(customerBOrder.customerId).toBe(otherCustomer.id);
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.customerId).sort()).toEqual(
      [fixture.customer.id, otherCustomer.id].sort()
    );
  });

  it("rolls back the idempotency row when order creation fails after the row is created", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const key = orderKey("rollback");

    await prisma.listing.update({
      where: { id: listingId },
      data: { tradeLockUntil: new Date(Date.now() + 60_000) },
    });

    await expect(createOrder(fixture.customer.id, [listingId], key)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("trade locked"),
    });

    expect(
      await prisma.orderIdempotencyKey.findMany({
        where: { customerId: fixture.customer.id, key },
      })
    ).toHaveLength(0);
    expect(await prisma.order.findMany({ where: { customerId: fixture.customer.id } })).toHaveLength(0);
    expect(await prisma.orderItem.findMany({ where: { listingId } })).toHaveLength(0);
    const listingAfterFailure = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(listingAfterFailure?.status).toBe("ACTIVE");
    expect(listingAfterFailure?.reservedByOrderId).toBeNull();

    await prisma.listing.update({
      where: { id: listingId },
      data: { tradeLockUntil: null },
    });

    const retry = await createOrder(fixture.customer.id, [listingId], key);
    const recordsAfterRetry = await prisma.orderIdempotencyKey.findMany({
      where: { customerId: fixture.customer.id, key },
    });
    const listingAfterRetry = await prisma.listing.findUnique({ where: { id: listingId } });

    expect(recordsAfterRetry).toHaveLength(1);
    expect(recordsAfterRetry[0].orderId).toBe(retry.id);
    expect(listingAfterRetry?.status).toBe("RESERVED");
    expect(listingAfterRetry?.reservedByOrderId).toBe(retry.id);
  });

  it("creates one business effect for concurrent retries with the same idempotency key", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const key = orderKey("concurrent-retry");

    const results = await Promise.allSettled([
      createOrder(fixture.customer.id, [listingId], key),
      createOrder(fixture.customer.id, [listingId], key),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ordersService.create>>> =>
        result.status === "fulfilled"
    );

    const orders = await prisma.order.findMany({ where: { customerId: fixture.customer.id } });
    const records = await prisma.orderIdempotencyKey.findMany({
      where: { customerId: fixture.customer.id, key },
    });
    const orderItems = await prisma.orderItem.findMany({ where: { listingId } });
    const reservedListings = await prisma.listing.findMany({
      where: { id: listingId, status: "RESERVED" },
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
  });

  it("preserves reservation concurrency for different business requests racing for one listing", async () => {
    const fixture = await createCheckoutGraph();
    const otherCustomer = await createUser({ name: "Buyer B" });
    const listingId = fixture.listings[0].id;

    const results = await Promise.allSettled([
      createOrder(fixture.customer.id, [listingId], orderKey("race-a")),
      createOrder(otherCustomer.id, [listingId], orderKey("race-b")),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ordersService.create>>> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter((result) => result.status === "rejected");
    const orders = await prisma.order.findMany({
      where: { items: { some: { listingId } } },
    });
    const orderItems = await prisma.orderItem.findMany({ where: { listingId } });
    const records = await prisma.orderIdempotencyKey.findMany();
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(orders).toHaveLength(1);
    expect(orderItems).toHaveLength(1);
    expect(records).toHaveLength(1);
    expect(listing?.status).toBe("RESERVED");
    expect(listing?.reservedByOrderId).toBe(fulfilled[0].value.id);
  });
});
