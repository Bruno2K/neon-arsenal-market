import { describe, expect, it, vi, beforeEach } from "vitest";
import { listListingsQueryDto } from "../listings.dto.js";
import { DEFAULT_LISTING_SORT, LISTING_SORTS, listingOrderBy } from "../listings.sort.js";
import { createdAtIdDescOrderBy } from "../../../shared/pagination/cursor.js";

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

const emptyPage = { items: [], total: 0 };

describe("GET /listings sort whitelist (#93)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listingsRepository.findMany).mockResolvedValue(emptyPage);
  });

  it("defaults to createdAt_desc and rejects unknown sort keys", () => {
    expect(listListingsQueryDto.parse({}).sort).toBeUndefined();
    expect(DEFAULT_LISTING_SORT).toBe("createdAt_desc");
    expect(LISTING_SORTS).toEqual([
      "createdAt_desc",
      "price_asc",
      "price_desc",
      "float_asc",
      "float_desc",
    ]);
    expect(listListingsQueryDto.safeParse({ sort: "popularity" }).success).toBe(false);
    expect(listListingsQueryDto.safeParse({ sort: "createdAt_asc" }).success).toBe(false);
  });

  it("maps each whitelist value to a PostgreSQL orderBy (not a page-slice sort)", () => {
    expect(listingOrderBy(undefined)).toEqual([...createdAtIdDescOrderBy]);
    expect(listingOrderBy("createdAt_desc")).toEqual([...createdAtIdDescOrderBy]);
    expect(listingOrderBy("price_asc")).toEqual([{ price: "asc" }, { id: "asc" }]);
    expect(listingOrderBy("price_desc")).toEqual([{ price: "desc" }, { id: "desc" }]);
    expect(listingOrderBy("float_asc")).toEqual([{ floatValue: "asc" }, { id: "asc" }]);
    expect(listingOrderBy("float_desc")).toEqual([{ floatValue: "desc" }, { id: "desc" }]);
  });

  it.each(LISTING_SORTS)("service.list passes orderBy for %s to the repository", async (sort) => {
    await listingsService.list({ page: 1, limit: 20, sort });
    expect(listingsRepository.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      where: undefined,
      orderBy: listingOrderBy(sort),
    });
  });

  it("uses createdAt_desc when sort is omitted", async () => {
    await listingsService.list({ page: 1, limit: 20 });
    expect(listingsRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: listingOrderBy("createdAt_desc") })
    );
  });

  it("ignores sort in cursor mode so keyset stays createdAt+id", async () => {
    vi.mocked(listingsRepository.findManyByKeyset).mockResolvedValue({ items: [], hasMore: false });
    await listingsService.list({ cursor: "", page: 1, limit: 20, sort: "price_asc" });
    expect(listingsRepository.findManyByKeyset).toHaveBeenCalled();
    expect(listingsRepository.findMany).not.toHaveBeenCalled();
  });
});
