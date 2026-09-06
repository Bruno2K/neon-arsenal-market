/** Market catalog query: URL is the source of truth. */

export const MARKET_EXTERIORS = [
  "",
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;

export const MARKET_SORTS = [
  { value: "", label: "Padrão" },
  { value: "price-asc", label: "Menor Preço" },
  { value: "price-desc", label: "Maior Preço" },
  { value: "float-asc", label: "Menor Float" },
  { value: "float-desc", label: "Maior Float" },
] as const;

export const MARKET_PAGE_SIZE = 20;
export const MARKET_SEARCH_DEBOUNCE_MS = 300;
export const MARKET_SEARCH_PRODUCT_LIMIT = 100;

export type MarketExterior = (typeof MARKET_EXTERIORS)[number];
export type MarketSort = (typeof MARKET_SORTS)[number]["value"];

export interface MarketQuery {
  q: string;
  productId?: string;
  exterior: MarketExterior;
  isStattrak: boolean | undefined;
  minPrice: string;
  maxPrice: string;
  minFloat: string;
  maxFloat: string;
  sort: MarketSort;
  page: number;
}

const EXTERIOR_SET = new Set<string>(MARKET_EXTERIORS.filter(Boolean));
const SORT_SET = new Set<string>(MARKET_SORTS.map((item) => item.value));

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
  return SORT_SET.has(value) ? (value as MarketSort) : "";
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
  if (query.sort) params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function marketPath(query: Partial<MarketQuery> = {}): string {
  const params = serializeMarketQuery({
    q: "",
    exterior: "",
    isStattrak: undefined,
    minPrice: "",
    maxPrice: "",
    minFloat: "",
    maxFloat: "",
    sort: "",
    page: 1,
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
    query.sort,
  );
}

export function marketSearchEmptyTitle(term: string): string {
  return `Nenhum listing para ‘${term}’`;
}
