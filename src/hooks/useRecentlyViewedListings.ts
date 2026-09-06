import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { getListing } from "@/api/listings";
import {
  loadRecentlyViewedIds,
  normalizeRecentlyViewedId,
  selectRecentlyViewedListings,
  type RecentlyViewedFetchResult,
} from "@/lib/recentlyViewed";
import type { Listing } from "@/types/api";

export function useRecentlyViewedListings(excludeId?: string): Listing[] {
  const excluded = normalizeRecentlyViewedId(excludeId);
  const [storedIds, setStoredIds] = useState(loadRecentlyViewedIds);

  useEffect(() => {
    setStoredIds(loadRecentlyViewedIds());
  }, [excluded]);

  const fetchIds = useMemo(
    () => storedIds.filter((id) => id !== excluded),
    [storedIds, excluded],
  );

  const queries = useQueries({
    queries: fetchIds.map((id) => ({
      queryKey: ["listing", id] as const,
      queryFn: () => getListing(id),
      retry: false,
    })),
  });

  return useMemo(() => {
    const byId = new Map<string, RecentlyViewedFetchResult>();
    for (let index = 0; index < fetchIds.length; index += 1) {
      const id = fetchIds[index];
      const query = queries[index];
      if (!id || !query) continue;
      if (query.isError) {
        byId.set(id, "error");
        continue;
      }
      byId.set(id, query.data);
    }
    return selectRecentlyViewedListings(storedIds, byId, excluded ?? undefined);
  }, [excluded, fetchIds, queries, storedIds]);
}
