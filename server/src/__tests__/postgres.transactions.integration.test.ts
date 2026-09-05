import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { createCheckoutGraph, createOrder, orderKey } from "./helpers/index.js";

describe("PostgreSQL transactions", () => {
  it("commits order, items, reservation and idempotency key together", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const key = orderKey("commit");

    const created = await createOrder(fixture.customer.id, [listingId], key);

    const [orders, items, keys, listing] = await Promise.all([
      prisma.order.findMany({ where: { customerId: fixture.customer.id } }),
      prisma.orderItem.findMany({ where: { listingId } }),
      prisma.orderIdempotencyKey.findMany({ where: { customerId: fixture.customer.id, key } }),
      prisma.listing.findUnique({ where: { id: listingId } }),
    ]);

    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(created.id);
    expect(items).toHaveLength(1);
    expect(items[0].orderId).toBe(created.id);
    expect(keys).toHaveLength(1);
    expect(keys[0].orderId).toBe(created.id);
    expect(keys[0].status).toBe("COMPLETED");
    expect(listing?.status).toBe("RESERVED");
    expect(listing?.reservedByOrderId).toBe(created.id);
  });

  it("rolls back a partial write when the transaction throws after creating rows", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const customerId = fixture.customer.id;

    await expect(
      prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            customerId,
            totalAmount: new Prisma.Decimal("100.00"),
            status: "PENDING",
            paymentStatus: "PENDING",
          },
        });

        await tx.orderIdempotencyKey.create({
          data: {
            customerId,
            key: "forced-rollback",
            requestHash: "hash",
            status: "IN_PROGRESS",
            orderId: order.id,
          },
        });

        await tx.listing.update({
          where: { id: listingId },
          data: {
            status: "RESERVED",
            reservedByOrderId: order.id,
            reservedAt: new Date(),
            reservationExpiresAt: new Date(Date.now() + 60_000),
          },
        });

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            listingId,
            sellerId: fixture.seller.id,
            priceSnapshot: new Prisma.Decimal("100.00"),
          },
        });

        throw new Error("forced mid-transaction failure");
      })
    ).rejects.toThrow("forced mid-transaction failure");

    expect(await prisma.order.count({ where: { customerId } })).toBe(0);
    expect(await prisma.orderItem.count({ where: { listingId } })).toBe(0);
    expect(await prisma.orderIdempotencyKey.count({ where: { customerId } })).toBe(0);
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(listing?.status).toBe("ACTIVE");
    expect(listing?.reservedByOrderId).toBeNull();
  });

  it("conditional updateMany reserves a listing at most once", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;

    const results = await Promise.all([
      prisma.listing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: { status: "RESERVED", reservedByOrderId: "order-a" },
      }),
      prisma.listing.updateMany({
        where: { id: listingId, status: "ACTIVE" },
        data: { status: "RESERVED", reservedByOrderId: "order-b" },
      }),
    ]);

    const reservedCount = results.reduce((sum, result) => sum + result.count, 0);
    expect(reservedCount).toBe(1);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(listing?.status).toBe("RESERVED");
    expect(["order-a", "order-b"]).toContain(listing?.reservedByOrderId);
  });
});
