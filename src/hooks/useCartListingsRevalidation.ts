import { useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { getListing } from "@/api/listings";
import {
  assessCartLine,
  cartLinesArePayable,
  cartSnapshotNeedsUpdate,
  firstCartBlockage,
  type CartLineView,
  type CartSnapshotItem,
} from "@/lib/cartListingStatus";
import type { Listing } from "@/types/api";

export function useCartListingsRevalidation(
  items: CartSnapshotItem[],
  updateListing: (listing: Listing) => void,
): {
  lines: CartLineView[];
  blockage: string | null;
  canCheckout: boolean;
} {
  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["listing", item.listing.id] as const,
      queryFn: () => getListing(item.listing.id),
      staleTime: 0,
      refetchOnMount: "always" as const,
      retry: false,
    })),
  });

  useEffect(() => {
    for (let index = 0; index < items.length; index += 1) {
      const fresh = queries[index]?.data;
      const current = items[index]?.listing;
      if (!fresh || !current || fresh.id !== current.id) continue;
      if (fresh.status !== "ACTIVE") continue;
      if (!cartSnapshotNeedsUpdate(current, fresh)) continue;
      updateListing(fresh);
    }
  }, [items, queries, updateListing]);

  const lines = items.map((item, index) =>
    assessCartLine(item, {
      isPending: queries[index]?.isPending ?? true,
      isError: queries[index]?.isError ?? false,
      data: queries[index]?.data,
      refetch: () => {
        void queries[index]?.refetch();
      },
    }),
  );

  return {
    lines,
    blockage: firstCartBlockage(lines),
    canCheckout: cartLinesArePayable(lines),
  };
}
