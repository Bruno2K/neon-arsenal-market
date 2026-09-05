import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    listing: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    seller: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../listings.repository.js", () => ({
  listingsRepository: {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    findBySellerId: vi.fn(),
  },
}));

import { prisma } from "../../../shared/database/index.js";
import { listingsRepository } from "../listings.repository.js";
import { listingsService } from "../listings.service.js";

describe("listingsService reservation lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reserve()", () => {
    it("atomically reserves an ACTIVE listing with TTL timestamps", async () => {
      vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(listingsRepository.findById).mockResolvedValue({
        id: "listing-1",
        status: "RESERVED",
      } as never);

      const result = await listingsService.reserve("listing-1");

      expect(prisma.listing.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "listing-1", status: "ACTIVE" }),
          data: expect.objectContaining({
            status: "RESERVED",
            reservedAt: expect.any(Date),
            reservationExpiresAt: expect.any(Date),
          }),
        })
      );
      expect(result.status).toBe("RESERVED");
    });

    it("throws 400 when the listing is not ACTIVE", async () => {
      vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(listingsRepository.findById).mockResolvedValue({
        id: "listing-1",
        status: "SOLD",
        tradeLockUntil: null,
      } as never);

      await expect(listingsService.reserve("listing-1")).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("not ACTIVE"),
      });
    });
  });

  describe("markAsSold()", () => {
    it("refuses to sell an expired reservation", async () => {
      vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(listingsRepository.findById).mockResolvedValue({
        id: "listing-1",
        status: "RESERVED",
        reservationExpiresAt: new Date(0),
      } as never);

      await expect(listingsService.markAsSold("listing-1")).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe("expireReservations()", () => {
    it("releases only RESERVED listings whose expiration has passed", async () => {
      vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1);
      const now = new Date("2026-09-04T12:00:00.000Z");

      const result = await listingsService.expireReservations(now);

      expect(prisma.listing.updateMany).toHaveBeenCalledWith({
        where: {
          status: "RESERVED",
          OR: [{ reservationExpiresAt: { lte: now } }, { reservationExpiresAt: null }],
        },
        data: {
          status: "ACTIVE",
          reservedAt: null,
          reservationExpiresAt: null,
          reservedByOrderId: null,
        },
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result).toEqual({ expiredListingCount: 2, cancelledOrderCount: 1 });
    });

    it("does not target SOLD listings", async () => {
      vi.mocked(prisma.listing.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.$executeRaw).mockResolvedValue(0);

      await listingsService.expireReservations();

      const where = vi.mocked(prisma.listing.updateMany).mock.calls[0][0].where as {
        status: string;
      };
      expect(where.status).toBe("RESERVED");
    });
  });
});

describe("reservation TTL config", () => {
  const original = process.env.RESERVATION_TTL_MINUTES;

  afterEach(() => {
    if (original === undefined) delete process.env.RESERVATION_TTL_MINUTES;
    else process.env.RESERVATION_TTL_MINUTES = original;
  });

  it("defaults to 15 minutes", async () => {
    delete process.env.RESERVATION_TTL_MINUTES;
    const { getReservationTtlMinutes, getReservationTtlMs } = await import(
      "../../../shared/config/reservation.js"
    );
    expect(getReservationTtlMinutes()).toBe(15);
    expect(getReservationTtlMs()).toBe(15 * 60 * 1000);
  });

  it("ignores non-positive env values", async () => {
    process.env.RESERVATION_TTL_MINUTES = "0";
    const { getReservationTtlMinutes } = await import("../../../shared/config/reservation.js");
    expect(getReservationTtlMinutes()).toBe(15);
  });
});
