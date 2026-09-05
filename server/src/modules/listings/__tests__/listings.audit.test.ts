import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    listing: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    seller: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    priceHistory: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("../listings.repository.js", () => ({
  listingsRepository: {
    findById: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { listingsRepository } from "../listings.repository.js";
import { listingsService } from "../listings.service.js";

const listing = {
  id: "listing-1",
  sellerId: "seller-1",
  status: "ACTIVE",
  price: new Prisma.Decimal("100.00"),
};

describe("listingsService sensitive-action audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) =>
      fn(prisma)
    );
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.priceHistory.create).mockResolvedValue({} as never);
    vi.mocked(prisma.listing.update).mockResolvedValue(listing as never);
  });

  it("writes an audit row when the seller changes listing price", async () => {
    vi.mocked(listingsRepository.findById).mockResolvedValue(listing as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-1" } as never);

    await listingsService.updatePrice("listing-1", "user-1", "SELLER", { newPrice: 150 }, {
      actorId: "user-1",
      actorRole: "SELLER",
      ip: "203.0.113.10",
      userAgent: "vitest",
    });

    expect(prisma.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "listing-1" },
        data: { price: 150 },
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "LISTING_PRICE_CHANGE",
          resourceType: "Listing",
          resourceId: "listing-1",
          actorId: "user-1",
          actorRole: "SELLER",
          ip: "203.0.113.10",
          before: { price: new Prisma.Decimal("100.00").toString() },
          after: { price: String(150) },
        }),
      })
    );
  });

  it("writes an audit row when a listing is cancelled", async () => {
    vi.mocked(listingsRepository.findById).mockResolvedValue(listing as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-1" } as never);

    await listingsService.cancel("listing-1", "user-1", "SELLER", {
      actorId: "user-1",
      actorRole: "SELLER",
    });

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { status: "CANCELED" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "LISTING_CANCEL",
          resourceType: "Listing",
          resourceId: "listing-1",
          before: { status: "ACTIVE" },
          after: { status: "CANCELED" },
        }),
      })
    );
  });
});
