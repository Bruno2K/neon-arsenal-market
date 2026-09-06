import type { Listing } from "@/types/api";
import type { CartSnapshotItem } from "@/lib/cartListingStatus";

/**
 * Device-local cart persistence (issue #96).
 *
 * This is not an account cart and is not multi-device. The payload lives in
 * `localStorage` on this browser only. Logout keeps the guest cart: the same
 * device still sees the items after the session ends. A later server cart API
 * would be required to sync across devices or users.
 *
 * Availability revalidation is owned by the cart page hook. Hydration drops
 * snapshots that are already `CANCELED` so a clearly canceled listing is not
 * restored without a badge.
 */
export const CART_STORAGE_KEY = "neon-arsenal.cart";
export const CART_STORAGE_VERSION = 1;

export interface PersistedCartItemV1 {
  listingId: string;
  priceWhenAdded: Listing["price"];
  listing: Listing;
}

export interface PersistedCartV1 {
  version: typeof CART_STORAGE_VERSION;
  items: PersistedCartItemV1[];
}

type CartStorage = Pick<Storage, "getItem" | "setItem">;

function getBrowserStorage(): CartStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isListingSnapshot(value: unknown): value is Listing {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (typeof value.status !== "string") return false;
  if (!isRecord(value.product)) return false;
  return true;
}

export function parsePersistedCart(raw: string | null): CartSnapshotItem[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return [];
    if (parsed.version !== CART_STORAGE_VERSION) return [];
    if (!Array.isArray(parsed.items)) return [];

    const items: CartSnapshotItem[] = [];
    const seen = new Set<string>();

    for (const entry of parsed.items) {
      if (!isRecord(entry)) continue;
      const listing = isListingSnapshot(entry.listing)
        ? entry.listing
        : undefined;
      if (!listing) continue;
      if (listing.status === "CANCELED") continue;
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);

      const priceWhenAdded =
        entry.priceWhenAdded === undefined
          ? listing.price
          : (entry.priceWhenAdded as Listing["price"]);

      items.push({ listing, priceWhenAdded });
    }

    return items;
  } catch {
    return [];
  }
}

export function serializeCart(items: CartSnapshotItem[]): string {
  const persistable = items.filter(
    (item) => item.listing.status !== "CANCELED",
  );
  const payload: PersistedCartV1 = {
    version: CART_STORAGE_VERSION,
    items: persistable.map((item) => ({
      listingId: item.listing.id,
      priceWhenAdded: item.priceWhenAdded ?? item.listing.price,
      listing: item.listing,
    })),
  };
  return JSON.stringify(payload);
}

export function loadCartFromStorage(
  storage: CartStorage | null = getBrowserStorage(),
): CartSnapshotItem[] {
  if (!storage) return [];
  try {
    return parsePersistedCart(storage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveCartToStorage(
  items: CartSnapshotItem[],
  storage: CartStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CART_STORAGE_KEY, serializeCart(items));
    return true;
  } catch {
    return false;
  }
}
