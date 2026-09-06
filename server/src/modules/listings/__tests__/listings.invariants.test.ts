import { describe, it, expect, vi, beforeEach } from "vitest";
import { DomainInvariant } from "../../../shared/domain/invariants.js";

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
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../listings.repository.js", () => ({
  listingsRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { listingsRepository } from "../listings.repository.js";
import { listingsService } from "../listings.service.js";

const soldListing = {
  id: "listing-1",
  sellerId: "seller-1",
  status: "SOLD" as const,
};

describe(`${DomainInvariant.LISTING_SOLD_IRREVERSIBLE} listingsService`, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) =>
      fn(prisma)
    );
  });

  it("does not write listing status through the generic update path", async () => {
    vi.mocked(listingsRepository.findById).mockResolvedValue(soldListing as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-1" } as never);
    vi.mocked(listingsRepository.update).mockResolvedValue(soldListing as never);

    await listingsService.update("listing-1", "user-1", "SELLER", { price: 50 });

    expect(listingsRepository.update).toHaveBeenCalledWith("listing-1", { price: 50 });
  });

  it("rejects cancel of a SOLD listing", async () => {
    vi.mocked(listingsRepository.findById).mockResolvedValue(soldListing as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-1" } as never);

    await expect(listingsService.cancel("listing-1", "user-1", "SELLER")).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot cancel a SOLD listing",
    });
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });

  it("refuses markAsSold when the listing is already SOLD", async () => {
    vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(listingsRepository.findById).mockResolvedValue(soldListing as never);

    await expect(listingsService.markAsSold("listing-1")).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("must be RESERVED"),
    });
  });
});

describe(`${DomainInvariant.AUTH_OWNERSHIP} listingsService`, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a seller updating another seller's listing", async () => {
    vi.mocked(listingsRepository.findById).mockResolvedValue({
      id: "listing-1",
      sellerId: "seller-1",
      status: "ACTIVE",
    } as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-other" } as never);

    await expect(
      listingsService.update("listing-1", "user-other", "SELLER", { price: 50 })
    ).rejects.toMatchObject({ statusCode: 403, message: "Not your listing" });
    expect(listingsRepository.update).not.toHaveBeenCalled();
  });

  it("rejects a seller cancelling another seller's listing", async () => {
    vi.mocked(listingsRepository.findById).mockResolvedValue({
      id: "listing-1",
      sellerId: "seller-1",
      status: "ACTIVE",
    } as never);
    vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-other" } as never);

    await expect(listingsService.cancel("listing-1", "user-other", "SELLER")).rejects.toMatchObject({
      statusCode: 403,
      message: "Not your listing",
    });
  });
});
