import { describe, expect, it, vi, beforeEach } from "vitest";
import { listListingsQueryDto } from "../listings.dto.js";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    listing: {},
    seller: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../listings.repository.js", () => ({
  listingsRepository: {
    findMany: vi.fn(),
    findManyByKeyset: vi.fn(),
  },
}));

import { listingsRepository } from "../listings.repository.js";
import { listingsService } from "../listings.service.js";

describe("GET /listings weapon/rarity/game filters (#103)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listingsRepository.findMany).mockResolvedValue({ items: [], total: 0 });
  });

  it("accepts optional weapon, rarity, and game on the listings query DTO", () => {
    expect(listListingsQueryDto.parse({ weapon: "AK-47", rarity: "Covert", game: "CS2" })).toMatchObject({
      weapon: "AK-47",
      rarity: "Covert",
      game: "CS2",
    });
  });

  it("filters via related Product.weapon / rarity / game", async () => {
    await listingsService.list({
      page: 1,
      limit: 20,
      weapon: "AK-47",
      rarity: "Covert",
      game: "CS2",
    });

    expect(listingsRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          product: {
            weapon: { equals: "AK-47", mode: "insensitive" },
            rarity: { equals: "Covert", mode: "insensitive" },
            game: { equals: "CS2", mode: "insensitive" },
          },
        },
      })
    );
  });

  it("combines catalog filters with existing exterior and StatTrak predicates", async () => {
    await listingsService.list({
      page: 1,
      limit: 20,
      weapon: "AK-47",
      exterior: "Field-Tested",
      isStattrak: true,
    });

    expect(listingsRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          product: {
            exterior: "Field-Tested",
            isStattrak: true,
            weapon: { equals: "AK-47", mode: "insensitive" },
          },
        },
      })
    );
  });
});
