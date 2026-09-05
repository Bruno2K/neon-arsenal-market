import type { Listing } from "@/types/api";
import { isListingTradeLocked } from "@/lib/cartListingStatus";
import { listingStatusLabel } from "@/lib/userFacingApiError";

export const CART_CTA_ADD = "Adicionar ao Carrinho";
export const CART_CTA_IN_CART = "No carrinho";
export const CART_CTA_VIEW_CART = "Ver carrinho";
export const CART_CTA_SIMILAR = "Ver itens semelhantes";
export const CART_ADDED_MESSAGE = "Adicionado ao carrinho";

export type ListingCartCtaKind =
  | "available"
  | "in-cart"
  | "sold"
  | "reserved"
  | "canceled"
  | "trade-lock"
  | "unavailable";

export interface ListingCartCtaView {
  kind: ListingCartCtaKind;
  reason: string | null;
  canAdd: boolean;
}

function unavailableReason(status: string): string {
  const label = listingStatusLabel(status);
  return label === "Indefinido" ? "Indisponível" : label;
}

export function formatTradeLockUntil(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function resolveListingCartCta(
  listing: Pick<Listing, "status" | "tradeLockUntil">,
  inCart: boolean,
  now = Date.now(),
): ListingCartCtaView {
  if (listing.status === "SOLD") {
    return {
      kind: "sold",
      reason: listingStatusLabel("SOLD"),
      canAdd: false,
    };
  }
  if (listing.status === "RESERVED") {
    return {
      kind: "reserved",
      reason: listingStatusLabel("RESERVED"),
      canAdd: false,
    };
  }
  if (listing.status === "CANCELED") {
    return {
      kind: "canceled",
      reason: listingStatusLabel("CANCELED"),
      canAdd: false,
    };
  }
  if (listing.status !== "ACTIVE") {
    return {
      kind: "unavailable",
      reason: unavailableReason(listing.status),
      canAdd: false,
    };
  }
  if (isListingTradeLocked(listing, now)) {
    const until = listing.tradeLockUntil
      ? formatTradeLockUntil(listing.tradeLockUntil)
      : "";
    return {
      kind: "trade-lock",
      reason: until ? `Trade lock até ${until}` : "Trade lock ativo",
      canAdd: false,
    };
  }
  if (inCart) {
    return {
      kind: "in-cart",
      reason: CART_CTA_IN_CART,
      canAdd: false,
    };
  }
  return { kind: "available", reason: null, canAdd: true };
}
