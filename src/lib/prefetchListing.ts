import type { QueryClient } from "@tanstack/react-query";
import { getListing } from "@/api/listings";

const lastPrefetchAt = new Map<string, number>();
export const LISTING_PREFETCH_TTL_MS = 60_000;

/** At most one GET /listings/:id per listing per TTL (hover/focus). */
export function prefetchListingDetail(
  queryClient: QueryClient,
  listingId: string,
): void {
  if (!listingId) return;
  const now = Date.now();
  const last = lastPrefetchAt.get(listingId) ?? 0;
  if (now - last < LISTING_PREFETCH_TTL_MS) return;
  lastPrefetchAt.set(listingId, now);
  void queryClient.prefetchQuery({
    queryKey: ["listing", listingId],
    queryFn: () => getListing(listingId),
  });
}

export function resetListingPrefetchForTests(): void {
  lastPrefetchAt.clear();
}
