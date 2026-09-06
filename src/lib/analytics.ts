/**
 * Product-analytics wrapper for the storefront funnel.
 *
 * No vendor SDK and no required env var. Production is a no-op until a
 * collector is registered (consent / sink is a later decision).
 * Track failures never throw.
 */

export const ANALYTICS_EVENTS = [
  "page_view",
  "search",
  "search_result_click",
  "category_view",
  "product_view",
  "cart_add",
  "cart_remove",
  "checkout_started",
  "payment_started",
  "payment_return",
  "payment_cancel",
  "order_viewed",
  "seller_listing_created",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const ANALYTICS_SOURCES = [
  "home",
  "market",
  "related",
  "seller",
] as const;

export type AnalyticsSource = (typeof ANALYTICS_SOURCES)[number];

export type AnalyticsRole = "ADMIN" | "SELLER" | "CUSTOMER" | "guest";

/** Allowlisted props only. Never email, JWT, password, or names. */
export interface AnalyticsProps {
  listingId?: string;
  productId?: string;
  price?: string;
  source?: AnalyticsSource;
  path?: string;
  role?: AnalyticsRole;
  query?: string;
  category?: string;
  resultCount?: number;
  itemCount?: number;
  orderId?: string;
}

export type AnalyticsCollector = (
  event: AnalyticsEventName,
  props: AnalyticsProps,
) => void;

const ALLOWED_PROP_KEYS = [
  "listingId",
  "productId",
  "price",
  "source",
  "path",
  "role",
  "query",
  "category",
  "resultCount",
  "itemCount",
  "orderId",
] as const satisfies readonly (keyof AnalyticsProps)[];

const SOURCE_SET = new Set<string>(ANALYTICS_SOURCES);
const ROLE_SET = new Set<string>(["ADMIN", "SELLER", "CUSTOMER", "guest"]);

let collector: AnalyticsCollector | null = null;

export function setAnalyticsCollector(next: AnalyticsCollector | null): void {
  collector = next;
}

export function analyticsPrice(price: unknown): string | undefined {
  if (price == null || price === "") return undefined;
  return String(price);
}

export function isAnalyticsSource(value: unknown): value is AnalyticsSource {
  return typeof value === "string" && SOURCE_SET.has(value);
}

export function readAnalyticsSource(
  state: unknown,
): AnalyticsSource | undefined {
  if (!state || typeof state !== "object") return undefined;
  return isAnalyticsSource((state as { source?: unknown }).source)
    ? (state as { source: AnalyticsSource }).source
    : undefined;
}

export function marketSearchQuery(input: {
  q?: string;
  productId?: string;
  exterior?: string;
  isStattrak?: boolean;
  minPrice?: string;
  maxPrice?: string;
}): string | undefined {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.productId) params.set("productId", input.productId);
  if (input.exterior) params.set("exterior", input.exterior);
  if (input.isStattrak !== undefined) {
    params.set("isStattrak", String(input.isStattrak));
  }
  if (input.minPrice) params.set("minPrice", input.minPrice);
  if (input.maxPrice) params.set("maxPrice", input.maxPrice);
  const query = params.toString();
  return query || undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function sanitizeProps(props: Record<string, unknown>): AnalyticsProps {
  const safe: AnalyticsProps = {};

  for (const key of ALLOWED_PROP_KEYS) {
    const value = props[key];
    if (value == null || value === "") continue;

    if (key === "source") {
      if (isAnalyticsSource(value)) safe.source = value;
      continue;
    }
    if (key === "role") {
      if (typeof value === "string" && ROLE_SET.has(value)) {
        safe.role = value as AnalyticsRole;
      }
      continue;
    }
    if (key === "price") {
      const price = analyticsPrice(value);
      if (price) safe.price = price;
      continue;
    }
    if (key === "resultCount" || key === "itemCount") {
      const n = asFiniteNumber(value);
      if (n !== undefined) safe[key] = n;
      continue;
    }
    if (typeof value === "string") {
      safe[key] = value;
    }
  }

  return safe;
}

function emitDevConsole(
  event: AnalyticsEventName,
  props: AnalyticsProps,
): void {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.MODE === "test") return;
  console.info("[analytics]", event, props);
}

export function track(
  event: AnalyticsEventName,
  props: AnalyticsProps = {},
): void {
  try {
    const safe = sanitizeProps({ ...(props as Record<string, unknown>) });
    emitDevConsole(event, safe);
    collector?.(event, safe);
  } catch {
    // Product analytics must never break the UI.
  }
}
