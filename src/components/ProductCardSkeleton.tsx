// ─── Presentation: ProductCardSkeleton ───────────────────────────────────────
// Matches the exact layout of ProductCard so the page doesn't jump on load.

import { Skeleton } from '@/components/ui/skeleton';

export function ProductCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Thumbnail area */}
      <Skeleton className="aspect-square w-full" />

      <div className="p-3 space-y-2">
        {/* Product name */}
        <Skeleton className="h-4 w-3/4" />

        {/* Seller row */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Price + button row */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// Convenience grid of N skeletons
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
