import { describe, expect, it } from "vitest";
import type { Listing } from "@/types/api";
import {
  assessCartLine,
  cartLinesArePayable,
  cartListingName,
  cartSnapshotNeedsUpdate,
  firstCartBlockage,
  formatCartMoney,
  isListingPurchasable,
} from "../cartListingStatus";

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    productId: "prod-1",
    sellerId: "seller-1",
    price: 210,
    currency: "USD",
    status: "ACTIVE",
    floatValue: 0.15,
    pattern: null,
    tradeLockUntil: null,
    steamAssetId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    product: {
      id: "prod-1",
      game: "CS2",
      weapon: "AK-47",
      skinName: "Neon Rider",
      rarity: "Classified",
      exterior: "Field-Tested",
      isStattrak: false,
      isSouvenir: false,
      imageUrl: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    seller: { id: "seller-1", storeName: "Store Alpha" },
    ...overrides,
  };
}

const idleQuery = {
  isPending: false,
  isError: false,
  data: undefined as Listing | undefined,
  refetch: () => {},
};

describe("cartListingStatus", () => {
  it("formats names and money with Number()", () => {
    expect(cartListingName(listing())).toBe("AK-47 | Neon Rider");
    expect(formatCartMoney("210.5" as unknown as number)).toBe("$210.50");
  });

  it("treats SOLD, RESERVED, CANCELED and trade lock as not purchasable", () => {
    expect(isListingPurchasable(listing({ status: "SOLD" }))).toBe(false);
    expect(isListingPurchasable(listing({ status: "RESERVED" }))).toBe(false);
    expect(isListingPurchasable(listing({ status: "CANCELED" }))).toBe(false);
    expect(
      isListingPurchasable(
        listing({
          tradeLockUntil: new Date(Date.now() + 60_000).toISOString(),
        }),
      ),
    ).toBe(false);
    expect(isListingPurchasable(listing({ status: "ACTIVE" }))).toBe(true);
  });

  it("detects snapshot price and status drift", () => {
    expect(
      cartSnapshotNeedsUpdate(listing({ price: 210 }), listing({ price: 230 })),
    ).toBe(true);
    expect(
      cartSnapshotNeedsUpdate(listing(), listing({ status: "SOLD" })),
    ).toBe(true);
    expect(cartSnapshotNeedsUpdate(listing(), listing())).toBe(false);
  });

  it("marks a SOLD refetch as unavailable and not payable", () => {
    const line = assessCartLine(
      { listing: listing(), priceWhenAdded: 210 },
      { ...idleQuery, data: listing({ status: "SOLD" }) },
    );

    expect(line.kind).toBe("unavailable");
    expect(line.purchasable).toBe(false);
    expect(line.blockage).toBe("AK-47 | Neon Rider não está mais disponível");
    expect(cartLinesArePayable([line])).toBe(false);
    expect(firstCartBlockage([line])).toBe(
      "AK-47 | Neon Rider não está mais disponível",
    );
  });

  it("surfaces a price change without blocking checkout", () => {
    const line = assessCartLine(
      { listing: listing({ price: 210 }), priceWhenAdded: 210 },
      { ...idleQuery, data: listing({ price: 230 }) },
    );

    expect(line.kind).toBe("price-changed");
    expect(line.purchasable).toBe(true);
    expect(line.blockage).toBeNull();
    expect(formatCartMoney(line.previousPrice)).toBe("$210.00");
    expect(formatCartMoney(line.currentPrice)).toBe("$230.00");
    expect(cartLinesArePayable([line])).toBe(true);
  });

  it("keeps other lines payable when one row is still loading or failed", () => {
    const ok = assessCartLine(
      { listing: listing({ id: "ok", price: 100 }), priceWhenAdded: 100 },
      { ...idleQuery, data: listing({ id: "ok", price: 100 }) },
    );
    const failed = assessCartLine(
      { listing: listing({ id: "bad", price: 50 }), priceWhenAdded: 50 },
      { ...idleQuery, isError: true },
    );

    expect(ok.kind).toBe("available");
    expect(failed.kind).toBe("error");
    expect(failed.blockage).toBe(
      "Não foi possível atualizar AK-47 | Neon Rider.",
    );
    expect(firstCartBlockage([ok, failed])).toBe(
      "Não foi possível atualizar AK-47 | Neon Rider.",
    );
    expect(cartLinesArePayable([ok, failed])).toBe(false);
  });
});
