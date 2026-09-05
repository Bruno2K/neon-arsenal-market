import type { Listing } from "@/types/api";

export interface CartSnapshotItem {
  listing: Listing;
  priceWhenAdded?: Listing["price"];
}

export function cartListingName(listing: {
  product: { weapon: string; skinName: string };
}): string {
  return `${listing.product.weapon} | ${listing.product.skinName}`;
}

export function formatCartMoney(value: Listing["price"] | number): string {
  return `$${Number(value).toFixed(2)}`;
}

export function isListingTradeLocked(
  listing: Pick<Listing, "tradeLockUntil">,
  now = Date.now(),
): boolean {
  if (!listing.tradeLockUntil) return false;
  return new Date(listing.tradeLockUntil).getTime() > now;
}

export function isListingPurchasable(
  listing: Pick<Listing, "status" | "tradeLockUntil">,
  now = Date.now(),
): boolean {
  return listing.status === "ACTIVE" && !isListingTradeLocked(listing, now);
}

export function cartSnapshotNeedsUpdate(
  current: Pick<Listing, "price" | "status" | "tradeLockUntil">,
  fresh: Pick<Listing, "price" | "status" | "tradeLockUntil">,
): boolean {
  return (
    Number(current.price) !== Number(fresh.price) ||
    current.status !== fresh.status ||
    current.tradeLockUntil !== fresh.tradeLockUntil
  );
}

export type CartLineKind =
  | "loading"
  | "error"
  | "unavailable"
  | "price-changed"
  | "available";

export interface CartLineView {
  listingId: string;
  kind: CartLineKind;
  snapshot: Listing;
  display: Listing;
  name: string;
  purchasable: boolean;
  priceChanged: boolean;
  previousPrice: Listing["price"];
  currentPrice: Listing["price"];
  blockage: string | null;
  retry: () => void;
}

export function assessCartLine(
  item: CartSnapshotItem,
  query: {
    isPending: boolean;
    isError: boolean;
    data: Listing | undefined;
    refetch: () => void;
  },
  now = Date.now(),
): CartLineView {
  const snapshot = item.listing;
  const previousPrice = item.priceWhenAdded ?? snapshot.price;
  const fresh = query.data;
  const display = fresh ?? snapshot;
  const name = cartListingName(display);
  const retry = () => {
    void query.refetch();
  };

  if (query.isPending && !fresh) {
    return {
      listingId: snapshot.id,
      kind: "loading",
      snapshot,
      display,
      name,
      purchasable: false,
      priceChanged: false,
      previousPrice,
      currentPrice: display.price,
      blockage: "Verificando disponibilidade dos itens.",
      retry,
    };
  }

  if (query.isError && !fresh) {
    return {
      listingId: snapshot.id,
      kind: "error",
      snapshot,
      display,
      name,
      purchasable: false,
      priceChanged: false,
      previousPrice,
      currentPrice: display.price,
      blockage: `Não foi possível atualizar ${name}.`,
      retry,
    };
  }

  const current = fresh ?? snapshot;
  const purchasable = isListingPurchasable(current, now);
  if (!purchasable) {
    return {
      listingId: snapshot.id,
      kind: "unavailable",
      snapshot,
      display: current,
      name,
      purchasable: false,
      priceChanged: false,
      previousPrice,
      currentPrice: current.price,
      blockage: `${name} não está mais disponível`,
      retry,
    };
  }

  const priceChanged = Number(current.price) !== Number(previousPrice);
  return {
    listingId: snapshot.id,
    kind: priceChanged ? "price-changed" : "available",
    snapshot,
    display: current,
    name,
    purchasable: true,
    priceChanged,
    previousPrice,
    currentPrice: current.price,
    blockage: null,
    retry,
  };
}

export function firstCartBlockage(lines: CartLineView[]): string | null {
  for (const line of lines) {
    if (line.blockage) return line.blockage;
  }
  return null;
}

export function cartLinesArePayable(lines: CartLineView[]): boolean {
  return lines.length > 0 && lines.every((line) => line.purchasable);
}
