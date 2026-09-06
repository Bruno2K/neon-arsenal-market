import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";
import { DomainInvariant } from "../../../shared/domain/invariants.js";
import { LISTING_STATUSES } from "../../../shared/types/roles.js";

/** Same reproducible seed as `shared/domain/__tests__/invariants.property.test.ts`. */
const PROPERTY_SEED = 0x4e454f4e;

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

const PROPERTY = { seed: PROPERTY_SEED, numRuns: 16 } as const;

describe(`${DomainInvariant.LISTING_SOLD_IRREVERSIBLE} property`, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: (client: typeof prisma) => unknown) =>
      fn(prisma)
    );
  });

  it("SOLD never returns to ACTIVE, RESERVED, or CANCELED via cancel or markAsSold", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("ACTIVE", "RESERVED", "CANCELED"), async (attempted) => {
        vi.mocked(listingsRepository.findById).mockResolvedValue({
          id: "listing-1",
          sellerId: "seller-1",
          status: "SOLD",
        } as never);
        vi.mocked(prisma.seller.findUnique).mockResolvedValue({ id: "seller-1" } as never);
        vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 });

        await expect(listingsService.cancel("listing-1", "user-1", "SELLER")).rejects.toMatchObject({
          statusCode: 400,
          message: "Cannot cancel a SOLD listing",
        });
        expect(prisma.listing.update).not.toHaveBeenCalled();

        await expect(listingsService.markAsSold("listing-1")).rejects.toMatchObject({
          statusCode: 400,
          message: expect.stringContaining("must be RESERVED"),
        });
        expect(attempted).not.toBe("SOLD");
      }),
      PROPERTY
    );
  });

  it("expiration only targets RESERVED rows, so SOLD cannot regress", async () => {
    vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$executeRaw).mockResolvedValue(0);

    await listingsService.expireReservations(new Date("2026-09-06T00:00:00.000Z"));

    expect(prisma.listing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "RESERVED" }),
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
    expect(LISTING_STATUSES.filter((status) => status === "SOLD")).toEqual(["SOLD"]);
  });
});
