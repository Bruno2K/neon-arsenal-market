import type { Listing } from "@/types/api";

/**
 * Device-local recently viewed listing IDs (issue #105).
 *
 * This is not an account history, not multi-device, and not a
 * recommendation engine. The stack lives in `localStorage` on this
 * browser only. Display still fetches live listings and keeps only
 * ACTIVE rows so SOLD/RESERVED/CANCELED are not shown as buyable.
 */
export const RECENTLY_VIEWED_STORAGE_KEY = "neon-arsenal.recently-viewed";
export const RECENTLY_VIEWED_STORAGE_VERSION = 1;
export const RECENTLY_VIEWED_LIMIT = 12;

export const RECENTLY_VIEWED_HEADING = "Vistos recentemente";
export const RECENTLY_VIEWED_COPY = "Listings que você abriu neste navegador.";

export interface PersistedRecentlyViewedV1 {
  version: typeof RECENTLY_VIEWED_STORAGE_VERSION;
  ids: string[];
}

type RecentlyViewedStorage = Pick<Storage, "getItem" | "setItem">;

function getBrowserStorage(): RecentlyViewedStorage | null {
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

export function normalizeRecentlyViewedId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function pushRecentlyViewedId(
  ids: string[],
  listingId: string,
  limit = RECENTLY_VIEWED_LIMIT,
): string[] {
  const nextId = normalizeRecentlyViewedId(listingId);
  if (!nextId) return ids.slice(0, limit);
  return [nextId, ...ids.filter((id) => id !== nextId)].slice(0, limit);
}

export function parseRecentlyViewedIds(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return [];
    if (parsed.version !== RECENTLY_VIEWED_STORAGE_VERSION) return [];
    if (!Array.isArray(parsed.ids)) return [];

    const ids: string[] = [];
    const seen = new Set<string>();

    for (const entry of parsed.ids) {
      const id = normalizeRecentlyViewedId(entry);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= RECENTLY_VIEWED_LIMIT) break;
    }

    return ids;
  } catch {
    return [];
  }
}

export function serializeRecentlyViewedIds(ids: string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const entry of ids) {
    const id = normalizeRecentlyViewedId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= RECENTLY_VIEWED_LIMIT) break;
  }
  const payload: PersistedRecentlyViewedV1 = {
    version: RECENTLY_VIEWED_STORAGE_VERSION,
    ids: unique,
  };
  return JSON.stringify(payload);
}

export function loadRecentlyViewedIds(
  storage: RecentlyViewedStorage | null = getBrowserStorage(),
): string[] {
  if (!storage) return [];
  try {
    return parseRecentlyViewedIds(storage.getItem(RECENTLY_VIEWED_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecentlyViewedIds(
  ids: string[],
  storage: RecentlyViewedStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      RECENTLY_VIEWED_STORAGE_KEY,
      serializeRecentlyViewedIds(ids),
    );
    return true;
  } catch {
    return false;
  }
}

export function recordRecentlyViewedId(
  listingId: string,
  storage: RecentlyViewedStorage | null = getBrowserStorage(),
): string[] {
  const next = pushRecentlyViewedId(loadRecentlyViewedIds(storage), listingId);
  saveRecentlyViewedIds(next, storage);
  return next;
}

export function isRecentlyViewedBuyable(
  listing: Pick<Listing, "status">,
): boolean {
  return listing.status === "ACTIVE";
}

export type RecentlyViewedFetchResult = Listing | "error" | undefined;

/**
 * Keep storage order (most recent first). Skip failed IDs, the current
 * PDP listing, and rows that are not ACTIVE so SOLD is never shown as
 * a buyable card.
 */
export function selectRecentlyViewedListings(
  orderedIds: string[],
  byId: ReadonlyMap<string, RecentlyViewedFetchResult>,
  excludeId?: string,
): Listing[] {
  const excluded = normalizeRecentlyViewedId(excludeId);
  const items: Listing[] = [];

  for (const id of orderedIds) {
    if (excluded && id === excluded) continue;
    const entry = byId.get(id);
    if (entry === undefined || entry === "error") continue;
    if (!isRecentlyViewedBuyable(entry)) continue;
    items.push(entry);
  }

  return items;
}
