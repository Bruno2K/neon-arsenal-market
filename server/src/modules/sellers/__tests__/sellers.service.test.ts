import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    seller: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../sellers.repository.js", () => ({
  sellersRepository: {
    findMany: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    update: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { sellersRepository } from "../sellers.repository.js";
import { sellersService } from "../sellers.service.js";

const mockUser = (overrides = {}) => ({
  id: "user-1",
  name: "Bruno",
  email: "bruno@test.com",
  role: "CUSTOMER",
  ...overrides,
});

const mockSeller = (overrides = {}) => ({
  id: "seller-1",
  userId: "user-1",
  storeName: "Store Alpha",
  commissionRate: 0.1,
  balance: 0,
  rating: 0,
  isApproved: false,
  user: { id: "user-1", name: "Bruno", email: "bruno@test.com" },
  ...overrides,
});

describe("sellersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("apply()", () => {
    it("creates seller and updates user role to SELLER", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser() as any);
      vi.mocked(sellersRepository.findByUserId).mockResolvedValue(null);
      const newSeller = mockSeller();
      vi.mocked(prisma.seller.create).mockResolvedValue(newSeller as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const result = await sellersService.apply("user-1", {
        storeName: "Store Alpha",
        commissionRate: 0.1,
      });

      expect(prisma.seller.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            storeName: "Store Alpha",
          }),
        })
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { role: "SELLER" },
      });
      expect(result.storeName).toBe("Store Alpha");
    });

    it("throws 404 when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        sellersService.apply("unknown-user", { storeName: "Shop", commissionRate: 0.1 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 409 when user is already a seller", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser() as any);
      vi.mocked(sellersRepository.findByUserId).mockResolvedValue(mockSeller() as any);

      await expect(
        sellersService.apply("user-1", { storeName: "Dup Shop", commissionRate: 0.1 })
      ).rejects.toMatchObject({ statusCode: 409, message: "Already a seller" });
    });

    it("throws 403 when ADMIN tries to apply", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser({ role: "ADMIN" }) as any);

      await expect(
        sellersService.apply("admin-id", { storeName: "Admin Store", commissionRate: 0.1 })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe("approve()", () => {
    it("throws 404 when seller not found", async () => {
      vi.mocked(sellersRepository.findById).mockResolvedValue(null);

      await expect(sellersService.approve("non-existent", true)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("approves a seller", async () => {
      vi.mocked(sellersRepository.findById).mockResolvedValue(mockSeller() as any);
      vi.mocked(sellersRepository.update).mockResolvedValue(
        mockSeller({ isApproved: true }) as any
      );

      const result = await sellersService.approve("seller-1", true);

      expect(sellersRepository.update).toHaveBeenCalledWith("seller-1", { isApproved: true });
      expect(result.isApproved).toBe(true);
    });

    it("rejects a seller (isApproved=false)", async () => {
      vi.mocked(sellersRepository.findById).mockResolvedValue(
        mockSeller({ isApproved: true }) as any
      );
      vi.mocked(sellersRepository.update).mockResolvedValue(
        mockSeller({ isApproved: false }) as any
      );

      const result = await sellersService.approve("seller-1", false);

      expect(sellersRepository.update).toHaveBeenCalledWith("seller-1", { isApproved: false });
      expect(result.isApproved).toBe(false);
    });
  });

  describe("getById()", () => {
    it("throws 404 when seller not found", async () => {
      vi.mocked(sellersRepository.findById).mockResolvedValue(null);

      await expect(sellersService.getById("bad-id")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("returns seller when found", async () => {
      vi.mocked(sellersRepository.findById).mockResolvedValue(mockSeller() as any);

      const result = await sellersService.getById("seller-1");
      expect(result.id).toBe("seller-1");
    });
  });

  describe("list()", () => {
    it("returns all sellers when no filters", async () => {
      const sellers = [mockSeller(), mockSeller({ id: "seller-2" })];
      vi.mocked(sellersRepository.findMany).mockResolvedValue(sellers as any);

      const result = await sellersService.list();
      expect(result).toHaveLength(2);
    });

    it("passes isApproved filter to repository", async () => {
      vi.mocked(sellersRepository.findMany).mockResolvedValue([mockSeller({ isApproved: true })] as any);

      await sellersService.list({ isApproved: true });

      expect(sellersRepository.findMany).toHaveBeenCalledWith({ isApproved: true });
    });
  });
});
