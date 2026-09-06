import { Link } from "react-router-dom";
import type { Listing, Product } from "@/types/api";
import { ListingCartCta } from "@/components/ListingCartCta";

export function productDisplayName(
  product: Pick<Product, "weapon" | "skinName" | "exterior">,
): string {
  return `${product.weapon} | ${product.skinName} (${product.exterior})`;
}

export type SkinProduct = Pick<Product, "weapon" | "skinName" | "exterior"> & {
  imageUrl?: string | null;
};

const SKIN_THUMB_SIZE = {
  sm: "h-8 w-10",
  md: "h-12 w-16",
  lg: "h-16 w-24",
} as const;

export function SkinVisual({
  product,
  className = "text-2xl",
  padded = true,
  decorative = false,
}: {
  product: SkinProduct;
  className?: string;
  padded?: boolean;
  decorative?: boolean;
}) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt={decorative ? "" : productDisplayName(product)}
        className={
          padded
            ? "h-full w-full object-contain p-3"
            : "h-full w-full object-contain p-0.5"
        }
      />
    );
  }
  return (
    <span
      className={`font-semibold tracking-tight text-muted-foreground/70 ${className}`}
    >
      {product.weapon.slice(0, 3).toUpperCase()}
    </span>
  );
}

/** Compact catalog preview for tables, cart lines, and select options. */
export function SkinThumb({
  product,
  size = "md",
  decorative = false,
}: {
  product: SkinProduct;
  size?: keyof typeof SKIN_THUMB_SIZE;
  decorative?: boolean;
}) {
  return (
    <span
      className={`inline-flex ${SKIN_THUMB_SIZE[size]} shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/40 ring-1 ring-border`}
      aria-hidden={decorative || undefined}
    >
      <SkinVisual
        product={product}
        className="text-[10px]"
        padded={false}
        decorative={decorative}
      />
    </span>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  const price =
    typeof listing.price === "number" ? listing.price : Number(listing.price);
  const sellerName =
    listing.seller?.user?.name ?? listing.seller?.storeName ?? "";
  const productName = productDisplayName(listing.product);

  return (
    <article className="group flex flex-col overflow-hidden rounded-md border border-border bg-card">
      <Link
        to={`/listing/${listing.id}`}
        className="relative block aspect-[4/3] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-full items-center justify-center">
          <SkinVisual product={listing.product} />
        </div>
        {listing.product.isStattrak && (
          <span className="absolute left-2 top-2 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            StatTrak™
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          to={`/listing/${listing.id}`}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors hover:text-primary">
            {productName}
          </h3>
        </Link>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{sellerName}</span>
          <span className="tabular-nums">
            Float: {Number(listing.floatValue).toFixed(8)}
          </span>
        </div>
        {listing.pattern != null && (
          <span className="text-[10px] text-muted-foreground">
            Pattern: {listing.pattern}
          </span>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="tabular-nums text-base font-semibold text-foreground">
            ${price.toFixed(2)}
          </span>
          <ListingCartCta listing={listing} variant="card" />
        </div>
      </div>
    </article>
  );
}

export const ProductCard = ListingCard;
