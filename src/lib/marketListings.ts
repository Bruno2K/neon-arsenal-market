import { listListings, type ListListingsParams } from "@/api/listings";
import { listProducts } from "@/api/products";
import type { Listing, ListListingsResponse } from "@/types/api";
import {
  MARKET_PAGE_SIZE,
  MARKET_SEARCH_PRODUCT_LIMIT,
  isValidMarketRange,
  toListingSort,
  type MarketQuery,
  type MarketSort,
} from "@/lib/marketQuery";

function listingFilters(query: MarketQuery): ListListingsParams {
  return {
    status: "ACTIVE",
    sort: toListingSort(query.sort),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.exterior ? { exterior: query.exterior } : {}),
    ...(query.isStattrak !== undefined ? { isStattrak: query.isStattrak } : {}),
    ...(query.minPrice ? { minPrice: parseFloat(query.minPrice) } : {}),
    ...(query.maxPrice ? { maxPrice: parseFloat(query.maxPrice) } : {}),
    ...(query.minFloat ? { minFloat: parseFloat(query.minFloat) } : {}),
    ...(query.maxFloat ? { maxFloat: parseFloat(query.maxFloat) } : {}),
    ...(query.weapon ? { weapon: query.weapon } : {}),
    ...(query.rarity ? { rarity: query.rarity } : {}),
  };
}

/**
 * Only used when textual search merges several product pages into one
 * complete result set. Never used to re-sort a single GET /listings page.
 */
export function sortMarketListings(
  items: Listing[],
  sort: MarketSort,
): Listing[] {
  if (sort === "price_asc") {
    return [...items].sort((a, b) => Number(a.price) - Number(b.price));
  }
  if (sort === "price_desc") {
    return [...items].sort((a, b) => Number(b.price) - Number(a.price));
  }
  if (sort === "float_asc") {
    return [...items].sort(
      (a, b) => Number(a.floatValue) - Number(b.floatValue),
    );
  }
  if (sort === "float_desc") {
    return [...items].sort(
      (a, b) => Number(b.floatValue) - Number(a.floatValue),
    );
  }
  return items;
}

function emptyPage(page: number): ListListingsResponse {
  return { items: [], total: 0, page, limit: MARKET_PAGE_SIZE };
}

function paginate(
  items: Listing[],
  page: number,
  sort: MarketSort,
): ListListingsResponse {
  const sorted = sortMarketListings(items, sort);
  const start = (page - 1) * MARKET_PAGE_SIZE;
  return {
    items: sorted.slice(start, start + MARKET_PAGE_SIZE),
    total: sorted.length,
    page,
    limit: MARKET_PAGE_SIZE,
  };
}

/**
 * Storefront catalog. `GET /listings` has no `search`; resolve `q` through
 * `GET /products?search=` (weapon / skin / collection / marketHashName), then
 * load ACTIVE listings for those product ids.
 *
 * Sort is sent to GET /listings. The current page is not re-sorted.
 */
export async function fetchMarketListings(
  query: MarketQuery,
): Promise<ListListingsResponse> {
  if (!isValidMarketRange(query)) {
    return emptyPage(query.page);
  }

  const filters = listingFilters(query);

  if (!query.q) {
    return listListings({
      ...filters,
      page: query.page,
      limit: MARKET_PAGE_SIZE,
    });
  }

  const products = await listProducts({
    search: query.q,
    limit: MARKET_SEARCH_PRODUCT_LIMIT,
  });
  let ids = products.items.map((product) => product.id);
  if (query.productId) {
    ids = ids.filter((id) => id === query.productId);
  }
  if (ids.length === 0) return emptyPage(query.page);

  if (ids.length === 1) {
    return listListings({
      ...filters,
      productId: ids[0],
      page: query.page,
      limit: MARKET_PAGE_SIZE,
    });
  }

  const pages = await Promise.all(
    ids.map((productId) =>
      listListings({
        ...filters,
        productId,
        page: 1,
        limit: MARKET_SEARCH_PRODUCT_LIMIT,
      }),
    ),
  );
  const seen = new Set<string>();
  const merged: Listing[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return paginate(merged, query.page, query.sort);
}
