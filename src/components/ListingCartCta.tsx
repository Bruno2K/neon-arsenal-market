import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import type { Listing } from "@/types/api";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import {
  CART_ADDED_MESSAGE,
  CART_CTA_ADD,
  CART_CTA_SIMILAR,
  CART_CTA_VIEW_CART,
  resolveListingCartCta,
  similarItemsMarketPath,
} from "@/lib/listingCartCta";
import { cn } from "@/lib/utils";

export function ListingCartCta({
  listing,
  variant,
}: {
  listing: Listing;
  variant: "detail" | "card";
}) {
  const { addItem, items } = useCart();
  const [liveMessage, setLiveMessage] = useState("");
  const inCart = items.some((item) => item.listing.id === listing.id);
  const cta = resolveListingCartCta(listing, inCart);

  const onAdd = () => {
    const result = addItem(listing);
    if (result === "added") {
      setLiveMessage(CART_ADDED_MESSAGE);
    }
  };

  const liveRegion = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {liveMessage}
    </p>
  );

  if (cta.kind === "available") {
    if (variant === "detail") {
      return (
        <div className="flex w-full gap-3">
          {liveRegion}
          <Button className="flex-1" size="lg" onClick={onAdd}>
            <ShoppingCart className="mr-2 h-5 w-5" /> {CART_CTA_ADD}
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/cart">Ver Carrinho</Link>
          </Button>
        </div>
      );
    }
    return (
      <>
        {liveRegion}
        <Button
          size="icon"
          variant="outline"
          onClick={(event) => {
            event.preventDefault();
            onAdd();
          }}
          aria-label={CART_CTA_ADD}
        >
          <ShoppingCart className="h-4 w-4" />
        </Button>
      </>
    );
  }

  const reasonClass =
    variant === "detail"
      ? "text-sm text-muted-foreground"
      : "text-[11px] leading-tight text-muted-foreground";

  return (
    <div
      className={cn(
        "flex min-w-0 gap-2",
        variant === "detail"
          ? "w-full flex-col sm:flex-row sm:items-center"
          : "flex-col items-end text-right",
      )}
    >
      {liveRegion}
      {cta.reason ? <p className={reasonClass}>{cta.reason}</p> : null}
      {cta.kind === "in-cart" ? (
        <Button
          variant={variant === "detail" ? "default" : "link"}
          size={variant === "detail" ? "lg" : "sm"}
          className={
            variant === "card" ? "h-auto min-h-0 p-0 text-[11px]" : undefined
          }
          asChild
        >
          <Link to="/cart">{CART_CTA_VIEW_CART}</Link>
        </Button>
      ) : null}
      {cta.kind === "sold" ? (
        <Button
          variant={variant === "detail" ? "default" : "link"}
          size={variant === "detail" ? "lg" : "sm"}
          className={
            variant === "card" ? "h-auto min-h-0 p-0 text-[11px]" : undefined
          }
          asChild
        >
          <Link to={similarItemsMarketPath(listing.productId)}>
            {CART_CTA_SIMILAR}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
