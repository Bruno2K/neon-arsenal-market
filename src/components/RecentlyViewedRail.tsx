import { ListingCard } from "@/components/ProductCard";
import {
  RECENTLY_VIEWED_COPY,
  RECENTLY_VIEWED_HEADING,
} from "@/lib/recentlyViewed";
import type { Listing } from "@/types/api";

export function RecentlyViewedRail({
  listings,
  headingId = "recently-viewed-heading",
}: {
  listings: Listing[];
  headingId?: string;
}) {
  if (listings.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        {RECENTLY_VIEWED_HEADING}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {RECENTLY_VIEWED_COPY}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
