import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    listing: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    order: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
    },
    seller: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock repository
vi.mock("../orders.repository.js", () => ({
  ordersRepository: {
    findById: vi.fn(),
    findManyByCustomerId: vi.fn(),
    findManyBySellerId: vi.fn(),
    findMany: vi.fn(),
  },
}));

// Mock listings repository
vi.mock("../../listings/listings.repository.js", () => ({
  listingsRepository: { findById: vi.fn() },
}));

// Mock listings service
vi.mock("../../listings/listings.service.js", () => ({
  listingsService: {},
}));

import { prisma } from "../../../shared/database/index.js";
import { ordersRepository } from "../orders.repository.js";
import { ordersService } from "../orders.service.js";

const mockListing = (overrides = {}) => ({
  id: "listing-1",
  sellerId: "seller-1",
  price: 150.0 as unknown as import("@prisma/client/runtime/library").Decimal,
  status: "ACTIVE",
  tradeLockUntil: null,
  product: { weapon: "AK-47", skinName: "Redline" },
  ...overrides,
});

const mockOrder = (overrides = {}) => ({
  id: "order-1",
  customerId: "user-1",
  totalAmount: 150.0,
  status: "PENDING",
  paymentStatus: "PENDING",
  customer: { id: "user-1", name: "Bruno", email: "bruno@test.com" },
  items: [],
  ...overrides,
});

describe("ordersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create()", () => {
    it("creates order and reserves listing in transaction", async () => {
      const listing = mockListing();
      vi.mocked(prisma.listing.findMany).mockResolvedValue([listing] as any);

      const createdOrder = { id: "order-1", customerId: "user-1", totalAmount: 150, status: "PENDING", paymentStatus: "PENDING" };
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.create).mockResolvedValue(createdOrder as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.orderItem.create).mockResolvedValue({} as any);
        return fn(prisma);
      });

      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as any);

      const result = await ordersService.create("user-1", {
        items: [{ listingId: "listing-1" }],
      } as any);

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ["listing-1"] } } })
      );
      expect(result.id).toBe("order-1");
    });

    it("throws 404 when listing not found", async () => {
      vi.mocked(prisma.listing.findMany).mockResolvedValue([]);

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "non-existent" }] } as any)
      ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining("Listing not found") });
    });

    it("throws 400 when listing is not ACTIVE", async () => {
      vi.mocked(prisma.listing.findMany).mockResolvedValue([mockListing({ status: "SOLD" })] as any);

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] } as any)
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("not available") });
    });

    it("throws 400 when listing is trade locked", async () => {
      const futureDate = new Date(Date.now() + 86400000); // +1 day
      vi.mocked(prisma.listing.findMany).mockResolvedValue([
        mockListing({ tradeLockUntil: futureDate }),
      ] as any);

      await expect(
        ordersService.create("user-1", { items: [{ listingId: "listing-1" }] } as any)
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("trade locked") });
    });

    it("captures price snapshot at time of order creation", async () => {
      const listing = mockListing({ price: 299.99 as any });
      vi.mocked(prisma.listing.findMany).mockResolvedValue([listing] as any);

      const createdOrder = { id: "order-1", customerId: "user-1", totalAmount: 299.99 };
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.create).mockResolvedValue(createdOrder as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.orderItem.create).mockResolvedValue({} as any);
        return fn(prisma);
      });

      const returnedOrder = { ...mockOrder(), totalAmount: 299.99 };
      vi.mocked(ordersRepository.findById).mockResolvedValue(returnedOrder as any);

      const result = await ordersService.create("user-1", {
        items: [{ listingId: "listing-1" }],
      } as any);

      // Verify the orderItem was created with the price snapshot
      expect(prisma.orderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priceSnapshot: listing.price }),
        })
      );
      expect(result.totalAmount).toBe(299.99);
    });

    it("reserves listing status to RESERVED inside transaction", async () => {
      vi.mocked(prisma.listing.findMany).mockResolvedValue([mockListing()] as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        vi.mocked(prisma.order.create).mockResolvedValue({ id: "order-1" } as any);
        vi.mocked(prisma.listing.update).mockResolvedValue({} as any);
        vi.mocked(prisma.orderItem.create).mockResolvedValue({} as any);
        return fn(prisma);
      });
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as any);

      await ordersService.create("user-1", { items: [{ listingId: "listing-1" }] } as any);

      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "listing-1" },
          data: { status: "RESERVED" },
        })
      );
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
        mockOrder({ customer: { id: "other-user" } }) as any
      );

      await expect(
        ordersService.getById("order-1", "user-1", "CUSTOMER")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("allows CUSTOMER to access their own order", async () => {
      const order = mockOrder({ customer: { id: "user-1", name: "Bruno", email: "b@b.com" } });
      vi.mocked(ordersRepository.findById).mockResolvedValue(order as any);

      const result = await ordersService.getById("order-1", "user-1", "CUSTOMER");
      expect(result.id).toBe("order-1");
    });

    it("ADMIN can access any order", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as any);

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
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as any);

      await expect(
        ordersService.updateStatus("order-1", "seller-id", "SELLER", "CONFIRMED")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("throws 403 when CUSTOMER tries to update another user's order", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(
        mockOrder({ customer: { id: "other-user" } }) as any
      );

      await expect(
        ordersService.updateStatus("order-1", "user-1", "CUSTOMER", "CANCELLED")
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("ADMIN can update any order status", async () => {
      vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder() as any);
      vi.mocked(prisma.order.update).mockResolvedValue({ ...mockOrder(), status: "SHIPPED" } as any);

      await ordersService.updateStatus("order-1", "admin-id", "ADMIN", "SHIPPED");
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "SHIPPED" } })
      );
    });
  });

  describe("listByCustomer()", () => {
    it("delegates to repository", async () => {
      const orders = [mockOrder()];
      vi.mocked(ordersRepository.findManyByCustomerId).mockResolvedValue(orders as any);

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
      vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-1" } as any);
      vi.mocked(ordersRepository.findManyBySellerId).mockResolvedValue([mockOrder()] as any);

      const result = await ordersService.listBySeller("user-1");
      expect(ordersRepository.findManyBySellerId).toHaveBeenCalledWith("seller-1");
      expect(result).toHaveLength(1);
    });
  });
});
