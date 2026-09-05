import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import type { Listing } from "@/types/api";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";

export function ListingCard({ listing }: { listing: Listing }) {
  const { addItem } = useCart();
  const price =
    typeof listing.price === "number" ? listing.price : Number(listing.price);
  const sellerName =
    listing.seller?.user?.name ?? listing.seller?.storeName ?? "";
  const productName = `${listing.product.weapon} | ${listing.product.skinName} (${listing.product.exterior})`;
  const isAvailable =
    listing.status === "ACTIVE" &&
    (!listing.tradeLockUntil || new Date(listing.tradeLockUntil) <= new Date());
  const monogram = listing.product.weapon.slice(0, 3).toUpperCase();

  return (
    <article className="group flex flex-col overflow-hidden rounded-md border border-border bg-card">
      <Link
        to={`/listing/${listing.id}`}
        className="relative block aspect-[4/3] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-full items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-muted-foreground/70">
            {monogram}
          </span>
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
        <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
          <span className="tabular-nums text-base font-semibold text-foreground">
            ${price.toFixed(2)}
          </span>
          <Button
            size="icon"
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              addItem(listing);
            }}
            disabled={!isAvailable}
            title={
              !isAvailable ? "Item não disponível" : "Adicionar ao carrinho"
            }
            aria-label={
              !isAvailable ? "Item não disponível" : "Adicionar ao carrinho"
            }
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export const ProductCard = ListingCard;
