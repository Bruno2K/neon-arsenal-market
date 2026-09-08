import { describe, expect, it } from "vitest";
import type { Listing } from "@/types/api";
import {
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
  loadCartFromStorage,
  parsePersistedCart,
  saveCartToStorage,
  serializeCart,
} from "../cartStorage";

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    productId: "prod-1",
    sellerId: "seller-1",
    price: 150,
    currency: "BRL",
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
      skinName: "Redline",
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

describe("parsePersistedCart", () => {
  it("returns empty when JSON is invalid", () => {
    expect(parsePersistedCart("{not-json")).toEqual([]);
    expect(parsePersistedCart("null")).toEqual([]);
    expect(parsePersistedCart("[]")).toEqual([]);
  });

  it("returns empty when the schema version does not match", () => {
    expect(
      parsePersistedCart(
        JSON.stringify({
          version: 99,
          items: [
            {
              listingId: "listing-1",
              priceWhenAdded: 150,
              listing: listing(),
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("skips CANCELED snapshots and duplicate listing ids", () => {
    const active = listing();
    const canceled = listing({ id: "listing-canceled", status: "CANCELED" });
    const parsed = parsePersistedCart(
      JSON.stringify({
        version: CART_STORAGE_VERSION,
        items: [
          { listingId: active.id, priceWhenAdded: 150, listing: active },
          {
            listingId: canceled.id,
            priceWhenAdded: 10,
            listing: canceled,
          },
          { listingId: active.id, priceWhenAdded: 999, listing: active },
          { listingId: "bad", listing: { id: "bad" } },
        ],
      }),
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.listing.id).toBe("listing-1");
    expect(parsed[0]?.priceWhenAdded).toBe(150);
  });
});

describe("serializeCart / storage helpers", () => {
  it("writes versioned ids and snapshots, omitting CANCELED rows", () => {
    const raw = serializeCart([
      { listing: listing(), priceWhenAdded: 150 },
      {
        listing: listing({ id: "listing-canceled", status: "CANCELED" }),
        priceWhenAdded: 10,
      },
    ]);
    const payload = JSON.parse(raw) as {
      version: number;
      items: Array<{ listingId: string }>;
    };
    expect(payload.version).toBe(CART_STORAGE_VERSION);
    expect(payload.items.map((item) => item.listingId)).toEqual(["listing-1"]);
  });

  it("keeps memory writes from breaking when setItem throws", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(
      saveCartToStorage([{ listing: listing(), priceWhenAdded: 150 }], storage),
    ).toBe(false);
  });

  it("loads an empty cart when getItem throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
    };
    expect(loadCartFromStorage(storage)).toEqual([]);
  });

  it("round-trips a snapshot through a mock Storage", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    const item = { listing: listing(), priceWhenAdded: 150 };
    expect(saveCartToStorage([item], storage)).toBe(true);
    expect(memory.has(CART_STORAGE_KEY)).toBe(true);
    expect(loadCartFromStorage(storage)).toEqual([item]);
  });
});
