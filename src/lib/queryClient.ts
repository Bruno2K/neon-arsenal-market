import { QueryClient } from "@tanstack/react-query";

/**
 * Storefront QueryClient defaults (#118 / #119):
 * - GET queries retry once (transient 5xx / network), not the React Query 3x default.
 * - Mutations never retry (avoids duplicate POSTs).
 * - Listings staleTime is modest so Market feels fresh without a refetch storm.
 * - throwOnError stays false so page queries render ErrorState instead of crashing.
 */
export const QUERY_GET_RETRY = 1;
export const QUERY_MUTATION_RETRY = 0;
export const LISTINGS_STALE_TIME_MS = 30_000;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: QUERY_GET_RETRY,
        staleTime: LISTINGS_STALE_TIME_MS,
        throwOnError: false,
      },
      mutations: {
        retry: QUERY_MUTATION_RETRY,
      },
    },
  });
}
