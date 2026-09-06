/** Market catalog query: URL is the source of truth. */

import { MARKET_RARITIES } from "@/lib/catalogTaxonomy";
import type { ListingSort } from "@/api/listings";

export const MARKET_EXTERIORS = [
  "",
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;

/** URL + UI values match the GET /listings sort whitelist. */
export const MARKET_SORTS = [
  { value: "", label: "Padrão" },
  { value: "price_asc", label: "Menor Preço" },
  { value: "price_desc", label: "Maior Preço" },
  { value: "float_asc", label: "Menor Float" },
  { value: "float_desc", label: "Maior Float" },
] as const;

const LEGACY_SORT: Record<string, MarketSort> = {
  "price-asc": "price_asc",
  "price-desc": "price_desc",
  "float-asc": "float_asc",
  "float-desc": "float_desc",
  createdAt_desc: "",
  newest: "",
};

export const MARKET_PAGE_SIZE = 20;
export const MARKET_SEARCH_DEBOUNCE_MS = 300;
export const MARKET_SEARCH_PRODUCT_LIMIT = 100;
export const MARKET_SORT_DEFAULT_COPY = "mais recentes";
export const MARKET_FLOAT_HINT = "0.00–1.00";
export const MARKET_FLOAT_RANGE_ERROR =
  "O float mínimo não pode ser maior que o máximo.";
export const MARKET_FILTERS_EMPTY_TITLE = "Nenhum listing com estes filtros";
export const MARKET_CATALOG_EMPTY_TITLE = "Nenhum item encontrado";
export const MARKET_CATALOG_EMPTY_DESCRIPTION = "Tente ajustar os filtros";

export type MarketExterior = (typeof MARKET_EXTERIORS)[number];
export type MarketSort = (typeof MARKET_SORTS)[number]["value"];

export interface MarketQuery {
  q: string;
  productId?: string;
  exterior: string;
  isStattrak: boolean | undefined;
  minPrice: string;
  maxPrice: string;
  minFloat: string;
  maxFloat: string;
  weapon: string;
  rarity: string;
  sort: MarketSort;
  page: number;
}

const EXTERIOR_SET = new Set<string>(MARKET_EXTERIORS.filter(Boolean));
const SORT_SET = new Set<string>(MARKET_SORTS.map((item) => item.value));
const RARITY_SET = new Set<string>(MARKET_RARITIES);

function readTrimmed(params: URLSearchParams, key: string): string {
  return params.get(key)?.trim() ?? "";
}

function parsePage(value: string | null): number {
  if (!value?.trim()) return 1;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseMoney(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? trimmed : "";
}

function parseFloatRange(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? trimmed : "";
}

function parseStattrak(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true" || trimmed === "1") return true;
  if (trimmed === "false" || trimmed === "0") return false;
  return undefined;
}

function parseExterior(value: string): MarketExterior {
  return EXTERIOR_SET.has(value) ? (value as MarketExterior) : "";
}

function parseSort(value: string): MarketSort {
  if (LEGACY_SORT[value] !== undefined) return LEGACY_SORT[value];
  return SORT_SET.has(value) ? (value as MarketSort) : "";
}

function parseWeapon(value: string): string {
  return value;
}

function parseRarity(value: string): string {
  return RARITY_SET.has(value) ? value : "";
}

/** `q` wins over `search`. Empty / invalid values become defaults. */
export function parseMarketQuery(params: URLSearchParams): MarketQuery {
  const q = readTrimmed(params, "q") || readTrimmed(params, "search");
  const productId = readTrimmed(params, "productId") || undefined;
  return {
    q,
    productId,
    exterior: parseExterior(readTrimmed(params, "exterior")),
    isStattrak: parseStattrak(params.get("stattrak")),
    minPrice: parseMoney(readTrimmed(params, "minPrice")),
    maxPrice: parseMoney(readTrimmed(params, "maxPrice")),
    minFloat: parseFloatRange(readTrimmed(params, "minFloat")),
    maxFloat: parseFloatRange(readTrimmed(params, "maxFloat")),
    weapon: parseWeapon(readTrimmed(params, "weapon")),
    rarity: parseRarity(readTrimmed(params, "rarity")),
    sort: parseSort(readTrimmed(params, "sort")),
    page: parsePage(params.get("page")),
  };
}

export function serializeMarketQuery(query: MarketQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.productId) params.set("productId", query.productId);
  if (query.exterior) params.set("exterior", query.exterior);
  if (query.isStattrak !== undefined) {
    params.set("stattrak", String(query.isStattrak));
  }
  if (query.minPrice) params.set("minPrice", query.minPrice);
  if (query.maxPrice) params.set("maxPrice", query.maxPrice);
  if (query.minFloat) params.set("minFloat", query.minFloat);
  if (query.maxFloat) params.set("maxFloat", query.maxFloat);
  if (query.weapon) params.set("weapon", query.weapon);
  if (query.rarity) params.set("rarity", query.rarity);
  if (query.sort) params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function emptyMarketQuery(): MarketQuery {
  return {
    q: "",
    exterior: "",
    isStattrak: undefined,
    minPrice: "",
    maxPrice: "",
    minFloat: "",
    maxFloat: "",
    weapon: "",
    rarity: "",
    sort: "",
    page: 1,
  };
}

export function marketPath(query: Partial<MarketQuery> = {}): string {
  const params = serializeMarketQuery({
    ...emptyMarketQuery(),
    ...query,
  });
  const qs = params.toString();
  return qs ? `/products?${qs}` : "/products";
}

export function patchMarketQuery(
  current: URLSearchParams,
  patch: Partial<MarketQuery>,
): URLSearchParams {
  return serializeMarketQuery({ ...parseMarketQuery(current), ...patch });
}

export function hasMarketFilters(query: MarketQuery): boolean {
  return Boolean(
    query.q ||
    query.productId ||
    query.exterior ||
    query.isStattrak !== undefined ||
    query.minPrice ||
    query.maxPrice ||
    query.minFloat ||
    query.maxFloat ||
    query.weapon ||
    query.rarity ||
    query.sort,
  );
}

/** Filters that can zero the catalog (sort alone does not). */
export function hasActiveMarketConstraints(query: MarketQuery): boolean {
  return Boolean(
    query.q ||
    query.productId ||
    query.exterior ||
    query.isStattrak !== undefined ||
    query.minPrice ||
    query.maxPrice ||
    query.minFloat ||
    query.maxFloat ||
    query.weapon ||
    query.rarity,
  );
}

export function isValidNumericRange(min: string, max: string): boolean {
  if (!min || !max) return true;
  const low = Number(min);
  const high = Number(max);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return true;
  return low <= high;
}

export function isValidMarketRange(query: MarketQuery): boolean {
  return (
    isValidNumericRange(query.minFloat, query.maxFloat) &&
    isValidNumericRange(query.minPrice, query.maxPrice)
  );
}

export function toListingSort(sort: MarketSort): ListingSort {
  if (sort === "price_asc") return "price_asc";
  if (sort === "price_desc") return "price_desc";
  if (sort === "float_asc") return "float_asc";
  if (sort === "float_desc") return "float_desc";
  return "createdAt_desc";
}

export function describeMarketFilters(query: MarketQuery): string[] {
  const parts: string[] = [];
  if (query.q) parts.push(`busca “${query.q}”`);
  if (query.weapon) parts.push(`arma ${query.weapon}`);
  if (query.rarity) parts.push(`raridade ${query.rarity}`);
  if (query.exterior) parts.push(`exterior ${query.exterior}`);
  if (query.isStattrak === true) parts.push("StatTrak™");
  if (query.isStattrak === false) parts.push("sem StatTrak");
  if (query.minPrice || query.maxPrice) {
    parts.push(`preço ${query.minPrice || "0"}–${query.maxPrice || "∞"}`);
  }
  if (query.minFloat || query.maxFloat) {
    parts.push(`float ${query.minFloat || "0"}–${query.maxFloat || "1"}`);
  }
  return parts;
}

export function marketSearchEmptyTitle(term: string): string {
  return `Nenhum listing para ‘${term}’`;
}
