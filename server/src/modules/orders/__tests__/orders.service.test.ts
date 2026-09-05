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
    seller: {
      findUnique: vi.fn(),
    },
    orderIdempotency: {
      create: vi.fn(),
      update: vi.fn(),
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
import { fingerprintOrderCreate } from "../orders.idempotency.js";
import { Prisma } from "@prisma/client";

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

const IDEMPOTENCY_KEY = "idem-key-1";

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
    vi.mocked(prisma.orderIdempotency.create).mockResolvedValue({} as never);
    vi.mocked(prisma.orderIdempotency.update).mockResolvedValue({} as never);
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

      expect(prisma.orderIdempotency.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            key: IDEMPOTENCY_KEY,
            status: "PROCESSING",
          }),
        })
      );
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

    it("replays a completed order when the same key is used again", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.22.0",
        })
      );
      vi.mocked(prisma.orderIdempotency.findUnique).mockResolvedValue({
        status: "COMPLETED",
        fingerprint: fingerprintOrderCreate({
          items: [{ listingId: "listing-1" }],
        }),
        orderId: "order-1",
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

    it("rejects the same key with a different payload", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.22.0",
        })
      );
      vi.mocked(prisma.orderIdempotency.findUnique).mockResolvedValue({
        status: "COMPLETED",
        fingerprint: "other-fingerprint",
        orderId: "order-1",
      } as never);

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-2" }] }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("different request") });
    });

    it("rejects a concurrent in-progress key instead of creating another order", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "5.22.0",
        })
      );
      vi.mocked(prisma.orderIdempotency.findUnique).mockResolvedValue({
        status: "PROCESSING",
        fingerprint: fingerprintOrderCreate({
          items: [{ listingId: "listing-1" }],
        }),
        orderId: null,
      } as never);

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] }, IDEMPOTENCY_KEY)
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("already in progress"),
      });
      expect(prisma.listing.updateMany).not.toHaveBeenCalled();
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
