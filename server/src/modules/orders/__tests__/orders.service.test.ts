import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    listing: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    orderIdempotencyKey: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    seller: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../orders.repository.js", () => ({
  ordersRepository: {
    findById: vi.fn(),
    findManyByCustomerId: vi.fn(),
    findManyBySellerId: vi.fn(),
    findMany: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { ordersRepository } from "../orders.repository.js";
import { ordersService } from "../orders.service.js";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

const IDEMPOTENCY_KEY = "order-key-1";

const mockListing = (overrides = {}) => ({
  id: "listing-1",
  sellerId: "seller-1",
  price: new Prisma.Decimal("150.00"),
  status: "ACTIVE",
  tradeLockUntil: null,
  product: { weapon: "AK-47", skinName: "Redline" },
  ...overrides,
});

const mockOrder = (overrides = {}) => ({
  id: "order-1",
  customerId: "user-1",
  totalAmount: new Prisma.Decimal("150.00"),
  status: "PENDING",
  paymentStatus: "PENDING",
  customer: { id: "user-1", name: "Bruno", email: "bruno@test.com" },
  items: [],
  ...overrides,
});

describe("ordersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.order.create).mockResolvedValue({
      id: "order-1",
      customerId: "user-1",
      totalAmount: new Prisma.Decimal(0),
      status: "PENDING",
      paymentStatus: "PENDING",
    } as never);
    vi.mocked(prisma.order.update).mockResolvedValue({ id: "order-1" } as never);
    vi.mocked(prisma.orderIdempotencyKey.create).mockResolvedValue({} as never);
    vi.mocked(prisma.orderIdempotencyKey.update).mockResolvedValue({} as never);
  });

  describe("create()", () => {
    it("creates order and reserves listing in transaction", async () => {
      const listing = mockListing();
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.listing.findUnique).mockResolvedValue(listing as never);
        vi.mocked(prisma.order.create).mockResolvedValue({
          id: "order-1",
          customerId: "user-1",
          totalAmount: listing.price,
          status: "PENDING",
          paymentStatus: "PENDING",
        } as never);
        vi.mocked(prisma.orderItem.createMany).mockResolvedValue({ count: 1 } as never);
        return fn(prisma);
      });
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as never);

      const result = await ordersService.create("user-1", {
        items: [{ listingId: "listing-1" }],
      }, IDEMPOTENCY_KEY);

      expect(prisma.orderIdempotencyKey.create).toHaveBeenCalledWith({
        data: {
          customerId: "user-1",
          key: IDEMPOTENCY_KEY,
          requestHash: createOrderRequestHash(["listing-1"]),
          status: "IN_PROGRESS",
        },
      });
      expect(prisma.listing.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "listing-1",
            status: "ACTIVE",
            OR: expect.arrayContaining([
              { tradeLockUntil: null },
              { tradeLockUntil: { lte: expect.any(Date) } },
            ]),
          }),
          data: {
            status: "RESERVED",
            reservedAt: expect.any(Date),
            reservationExpiresAt: expect.any(Date),
            reservedByOrderId: "order-1",
          },
        })
      );
      expect(prisma.orderItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              listingId: "listing-1",
              sellerId: "seller-1",
              priceSnapshot: listing.price,
            }),
          ],
        })
      );
      expect(prisma.orderIdempotencyKey.update).toHaveBeenCalledWith({
        where: { customerId_key: { customerId: "user-1", key: IDEMPOTENCY_KEY } },
        data: { status: "COMPLETED", orderId: "order-1" },
      });
      expect(result.id).toBe("order-1");
    });

    it("persists reservedAt and reservationExpiresAt using the configured TTL", async () => {
      const listing = mockListing();
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.listing.findUnique).mockResolvedValue(listing as never);
        vi.mocked(prisma.order.create).mockResolvedValue({
          id: "order-1",
          customerId: "user-1",
          totalAmount: listing.price,
          status: "PENDING",
          paymentStatus: "PENDING",
        } as never);
        vi.mocked(prisma.orderItem.createMany).mockResolvedValue({ count: 1 } as never);
        return fn(prisma);
      });
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as never);

      await ordersService.create("user-1", { items: [{ listingId: "listing-1" }] }, IDEMPOTENCY_KEY);

      const { getReservationTtlMs } = await import("../../../shared/config/reservation.js");
      const data = vi.mocked(prisma.listing.updateMany).mock.calls[0][0].data as {
        reservedAt: Date;
        reservationExpiresAt: Date;
      };
      expect(data.reservationExpiresAt.getTime() - data.reservedAt.getTime()).toBe(
        getReservationTtlMs()
      );
    });

    it("throws 404 when listing not found", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 } as never);
        vi.mocked(prisma.listing.findUnique).mockResolvedValue(null);
        return fn(prisma);
      });

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "non-existent" }] }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining("Listing not found") });
    });

    it("throws 400 when listing is not ACTIVE", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 } as never);
        vi.mocked(prisma.listing.findUnique).mockResolvedValue(mockListing({ status: "SOLD" }) as never);
        return fn(prisma);
      });

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("not available") });
    });

    it("throws 400 when listing is trade locked", async () => {
      const futureDate = new Date(Date.now() + 86400000);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 } as never);
        vi.mocked(prisma.listing.findUnique).mockResolvedValue(
          mockListing({ tradeLockUntil: futureDate }) as never
        );
        return fn(prisma);
      });

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("trade locked") });
    });

    it("captures price snapshot at time of order creation", async () => {
      const listing = mockListing({ price: new Prisma.Decimal("299.99") });
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 1 } as never);
        vi.mocked(prisma.listing.findUnique).mockResolvedValue(listing as never);
        vi.mocked(prisma.order.create).mockResolvedValue({
          id: "order-1",
          customerId: "user-1",
          totalAmount: listing.price,
        } as never);
        vi.mocked(prisma.orderItem.createMany).mockResolvedValue({ count: 1 } as never);
        return fn(prisma);
      });
      vi.mocked(ordersRepository.findById).mockResolvedValue(
        mockOrder({ totalAmount: new Prisma.Decimal("299.99") }) as never
      );

      const result = await ordersService.create("user-1", {
        items: [{ listingId: "listing-1" }],
      }, IDEMPOTENCY_KEY);

      expect(prisma.orderItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ priceSnapshot: listing.price }),
          ]),
        })
      );
      expect(result.totalAmount).toEqual(new Prisma.Decimal("299.99"));
    });

    it("rejects duplicate listing IDs in the same order", async () => {
      await expect(
        ordersService.create("user-1", {
          items: [{ listingId: "listing-1" }, { listingId: "listing-1" }],
        }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("fails reservation when another transaction already reserved the listing", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) => {
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 } as never);
        vi.mocked(prisma.listing.findUnique).mockResolvedValue(
          mockListing({ status: "RESERVED" }) as never
        );
        return fn(prisma);
      });

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("not available") });
    });

    it("requires an idempotency key", async () => {
      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] }, " ")
      ).rejects.toMatchObject({ statusCode: 400, message: "Idempotency-Key header is required" });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns the original order when an idempotency key is retried with the same request", async () => {
      const duplicateKeyError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.22.0", meta: { target: ["customerId", "key"] } }
      );
      vi.mocked(prisma.$transaction).mockRejectedValue(duplicateKeyError);
      vi.mocked(prisma.orderIdempotencyKey.findUnique).mockResolvedValue({
        id: "idempotency-1",
        customerId: "user-1",
        key: IDEMPOTENCY_KEY,
        requestHash: createOrderRequestHash(["listing-1"]),
        status: "COMPLETED",
        orderId: "order-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as never);

      const result = await ordersService.create(
        "user-1",
        { items: [{ listingId: "listing-1" }] },
        IDEMPOTENCY_KEY
      );

      expect(result.id).toBe("order-1");
      expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an idempotency key reused with a different request", async () => {
      const duplicateKeyError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.22.0", meta: { target: ["customerId", "key"] } }
      );
      vi.mocked(prisma.$transaction).mockRejectedValue(duplicateKeyError);
      vi.mocked(prisma.orderIdempotencyKey.findUnique).mockResolvedValue({
        id: "idempotency-1",
        customerId: "user-1",
        key: IDEMPOTENCY_KEY,
        requestHash: createOrderRequestHash(["listing-2"]),
        status: "COMPLETED",
        orderId: "order-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("different order request") });

      expect(ordersRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("getById()", () => {
    it("throws 404 when order not found", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(null);

      await expect(
        ordersService.getById("order-x", "user-1", "CUSTOMER")
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 403 when CUSTOMER tries to access another user's order", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(
        mockOrder({ customer: { id: "other-user" } }) as never
      );

      await expect(
        ordersService.getById("order-1", "user-1", "CUSTOMER")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("allows CUSTOMER to access their own order", async () => {
      const order = mockOrder({ customer: { id: "user-1", name: "Bruno", email: "b@b.com" } });
      vi.mocked(ordersRepository.findById).mockResolvedValue(order as never);

      const result = await ordersService.getById("order-1", "user-1", "CUSTOMER");
      expect(result.id).toBe("order-1");
    });

    it("ADMIN can access any order", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as never);

      const result = await ordersService.getById("order-1", "admin-id", "ADMIN");
      expect(result.id).toBe("order-1");
    });
  });

  describe("updateStatus()", () => {
    it("throws 404 when order not found", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(null);

      await expect(
        ordersService.updateStatus("order-x", "user-1", "ADMIN", "SHIPPED")
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 403 when SELLER tries to update order status", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as never);

      await expect(
        ordersService.updateStatus("order-1", "seller-id", "SELLER", "CONFIRMED")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("throws 403 when CUSTOMER tries to update another user's order", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(
        mockOrder({ customer: { id: "other-user" } }) as never
      );

      await expect(
        ordersService.updateStatus("order-1", "user-1", "CUSTOMER", "CANCELLED")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("ADMIN can update any order status", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as never);
      vi.mocked(prisma.order.update).mockResolvedValue({ ...mockOrder(), status: "SHIPPED" } as never);

      await ordersService.updateStatus("order-1", "admin-id", "ADMIN", "SHIPPED");
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "SHIPPED" } })
      );
    });
  });

  describe("listByCustomer()", () => {
    it("delegates to repository", async () => {
      const orders = [mockOrder()];
      vi.mocked(ordersRepository.findManyByCustomerId).mockResolvedValue(orders as never);

      const result = await ordersService.listByCustomer("user-1");
      expect(ordersRepository.findManyByCustomerId).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(orders);
    });
  });

  describe("listBySeller()", () => {
    it("throws 404 when seller profile not found", async () => {
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(null);

      await expect(ordersService.listBySeller("user-with-no-seller")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("returns orders for existing seller", async () => {
      vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-1" } as never);
      vi.mocked(ordersRepository.findManyBySellerId).mockResolvedValue([mockOrder()] as never);

      const result = await ordersService.listBySeller("user-1");
      expect(ordersRepository.findManyBySellerId).toHaveBeenCalledWith("seller-1");
      expect(result).toHaveLength(1);
    });
  });
});

function createOrderRequestHash(listingIds: string[]) {
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, listingIds: [...listingIds].sort() }))
    .digest("hex");
}
