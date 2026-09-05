import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

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
import { openApiSpec } from "../../../shared/docs/openapi.js";

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
    it("returns seller balance as Prisma Decimal, not a JavaScript number", async () => {
      const stored = new Prisma.Decimal("1250.75");
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(mockSeller({ balance: stored }) as any);
      vi.mocked(commissionsRepository.getBalance).mockResolvedValue(stored);

      const result = await commissionsService.getBalance("user-1");

      expect(result.balance).toBeInstanceOf(Prisma.Decimal);
      expect(result.balance.equals(stored)).toBe(true);
      expect(typeof result.balance).not.toBe("number");
    });

    it("JSON-serializes balance as a Decimal string that keeps scale", async () => {
      const stored = new Prisma.Decimal("1250.75");
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(mockSeller({ balance: stored }) as any);
      vi.mocked(commissionsRepository.getBalance).mockResolvedValue(stored);

      const result = await commissionsService.getBalance("user-1");
      const json = JSON.parse(JSON.stringify(result)) as { balance: unknown };

      expect(typeof json.balance).toBe("string");
      expect(json.balance).toBe("1250.75");
      expect(new Prisma.Decimal(json.balance as string).equals(stored)).toBe(true);
    });

    it("does not coerce 0.10 + 0.20 through JavaScript number on the HTTP JSON path", async () => {
      const stored = new Prisma.Decimal("0.10").plus(new Prisma.Decimal("0.20"));
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(mockSeller({ balance: stored }) as any);
      vi.mocked(commissionsRepository.getBalance).mockResolvedValue(stored);

      const result = await commissionsService.getBalance("user-1");
      const json = JSON.parse(JSON.stringify(result)) as { balance: unknown };

      expect(typeof json.balance).toBe("string");
      expect(new Prisma.Decimal(json.balance as string).equals(new Prisma.Decimal("0.30"))).toBe(true);
      expect(json.balance).not.toBe(0.1 + 0.2);
    });

    it("throws 404 when seller not found", async () => {
      vi.mocked(prisma.seller.findUnique).mockResolvedValue(null);

      await expect(commissionsService.getBalance("unknown-user")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

describe("OpenAPI GET /commissions/balance", () => {
  it("documents balance as a Decimal string, not a JSON number", () => {
    const schema = openApiSpec.paths["/commissions/balance"].get.responses[200].content[
      "application/json"
    ].schema;
    expect(schema.properties.balance.type).toBe("string");
    expect(schema.properties.balance.type).not.toBe("number");
  });
});
