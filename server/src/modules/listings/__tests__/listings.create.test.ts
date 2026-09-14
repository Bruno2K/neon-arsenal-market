import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    seller: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../listings.repository.js", () => ({
  listingsRepository: {
    create: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { listingsRepository } from "../listings.repository.js";
import { listingsService } from "../listings.service.js";

const baseInput = {
  productId: "product-1",
  floatValue: 0.15,
  price: 100,
  currency: "BRL" as const,
};

describe("listingsService.create — AUD-009 seller approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: "product-1" } as never);
    vi.mocked(listingsRepository.create).mockResolvedValue({ id: "listing-1" } as never);
  });

  it("rejects listing creation for a pending (unapproved) seller with 403", async () => {
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({
      id: "seller-1",
      isApproved: false,
    } as never);

    await expect(listingsService.create("user-1", baseInput)).rejects.toMatchObject({
      statusCode: 403,
      message: "Seller is not approved",
    });
    expect(listingsRepository.create).not.toHaveBeenCalled();
  });

  it("allows listing creation for an approved seller", async () => {
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({
      id: "seller-1",
      isApproved: true,
    } as never);

    await expect(listingsService.create("user-1", baseInput)).resolves.toMatchObject({
      id: "listing-1",
    });
    expect(listingsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        seller: { connect: { id: "seller-1" } },
      })
    );
  });

  it("still returns 404 when the caller has no Seller row at all", async () => {
    vi.mocked(prisma.seller.findUnique).mockResolvedValue(null);

    await expect(listingsService.create("user-1", baseInput)).rejects.toMatchObject({
      statusCode: 404,
      message: "Seller not found",
    });
  });
});
