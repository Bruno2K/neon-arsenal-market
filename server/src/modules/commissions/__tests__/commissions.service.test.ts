import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    seller: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../commissions.repository.js", () => ({
  commissionsRepository: {
    findMany: vi.fn(),
    findManyBySellerId: vi.fn(),
    getBalance: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { commissionsRepository } from "../commissions.repository.js";
import { commissionsService } from "../commissions.service.js";

const mockSeller = (overrides = {}) => ({
  id: "seller-1",
  userId: "user-1",
  storeName: "Store Alpha",
  balance: 250.0,
  ...overrides,
});

describe("commissionsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listTransactions()", () => {
    it("ADMIN gets all transactions", async () => {
      const allTransactions = [
        { id: "tx-1", sellerId: "seller-1", grossAmount: 100 },
        { id: "tx-2", sellerId: "seller-2", grossAmount: 200 },
      ];
      vi.mocked(commissionsRepository.findMany).mockResolvedValue(allTransactions as any);

      const result = await commissionsService.listTransactions("admin-id", "ADMIN");

      expect(commissionsRepository.findMany).toHaveBeenCalled();
      expect(commissionsRepository.findManyBySellerId).not.toHaveBeenCalled();
      expect(result).toEqual(allTransactions);
    });

    it("SELLER gets only their own transactions", async () => {
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(mockSeller() as any);
      const sellerTx = [{ id: "tx-1", sellerId: "seller-1", grossAmount: 100 }];
      vi.mocked(commissionsRepository.findManyBySellerId).mockResolvedValue(sellerTx as any);

      const result = await commissionsService.listTransactions("user-1", "SELLER");

      expect(prisma.seller.findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
      expect(commissionsRepository.findManyBySellerId).toHaveBeenCalledWith("seller-1");
      expect(result).toEqual(sellerTx);
    });

    it("throws 404 when SELLER profile not found", async () => {
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(null);

      await expect(
        commissionsService.listTransactions("user-no-seller", "SELLER")
      ).rejects.toMatchObject({ statusCode: 404, message: "Seller not found" });
    });
  });

  describe("getBalance()", () => {
    it("returns seller balance as a number", async () => {
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(mockSeller({ balance: 375.5 }) as any);
      vi.mocked(commissionsRepository.getBalance).mockResolvedValue(375.5 as any);

      const result = await commissionsService.getBalance("user-1");

      expect(result).toEqual({ balance: 375.5 });
      expect(typeof result.balance).toBe("number");
    });

    it("throws 404 when seller not found", async () => {
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(null);

      await expect(commissionsService.getBalance("unknown-user")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
