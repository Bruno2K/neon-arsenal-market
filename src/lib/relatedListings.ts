import type { Listing } from "@/types/api";

export function excludeListingIds(
  items: Listing[],
  excludeIds: ReadonlySet<string>,
): Listing[] {
  return items.filter((item) => !excludeIds.has(item.id));
}

export function takeUniqueListings(
  items: Listing[],
  excludeIds: ReadonlySet<string>,
  limit: number,
): Listing[] {
  const seen = new Set(excludeIds);
  const result: Listing[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

export function relatedSkinHeading(count: number): string {
  return count > 0
    ? "Outros listings desta skin"
    : "Outros listings desta skin";
}

export function relatedFallbackHeading(kind: "weapon" | "collection"): string {
  return kind === "collection"
    ? "Outros listings desta coleção"
    : "Outros listings desta arma";
}

export function moreFromSellerHeading(storeName: string): string {
  return `Mais de ${storeName}`;
}
