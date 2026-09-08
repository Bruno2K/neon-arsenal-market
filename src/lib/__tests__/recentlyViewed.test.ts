import { describe, expect, it } from "vitest";
import type { Listing } from "@/types/api";
import {
  RECENTLY_VIEWED_LIMIT,
  RECENTLY_VIEWED_STORAGE_KEY,
  RECENTLY_VIEWED_STORAGE_VERSION,
  isRecentlyViewedBuyable,
  loadRecentlyViewedIds,
  parseRecentlyViewedIds,
  pushRecentlyViewedId,
  recordRecentlyViewedId,
  saveRecentlyViewedIds,
  selectRecentlyViewedListings,
  serializeRecentlyViewedIds,
} from "../recentlyViewed";

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    productId: "prod-1",
    sellerId: "seller-1",
    price: 22,
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

function memoryStorage(initial?: string) {
  const memory = new Map<string, string>();
  if (initial !== undefined) {
    memory.set(RECENTLY_VIEWED_STORAGE_KEY, initial);
  }
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    memory,
  };
}

describe("parseRecentlyViewedIds", () => {
  it("returns empty when JSON is invalid or the version does not match", () => {
    expect(parseRecentlyViewedIds("{not-json")).toEqual([]);
    expect(parseRecentlyViewedIds("null")).toEqual([]);
    expect(parseRecentlyViewedIds("[]")).toEqual([]);
    expect(
      parseRecentlyViewedIds(
        JSON.stringify({ version: 99, ids: ["listing-1"] }),
      ),
    ).toEqual([]);
  });

  it("keeps most-recent-first unique ids and drops blanks", () => {
    expect(
      parseRecentlyViewedIds(
        JSON.stringify({
          version: RECENTLY_VIEWED_STORAGE_VERSION,
          ids: [" listing-2 ", "listing-1", "listing-2", "", "   ", 4],
        }),
      ),
    ).toEqual(["listing-2", "listing-1"]);
  });

  it("caps the stack at 12 ids", () => {
    const ids = Array.from({ length: 20 }, (_, index) => `listing-${index}`);
    expect(
      parseRecentlyViewedIds(
        JSON.stringify({
          version: RECENTLY_VIEWED_STORAGE_VERSION,
          ids,
        }),
      ),
    ).toEqual(ids.slice(0, RECENTLY_VIEWED_LIMIT));
  });
});

describe("pushRecentlyViewedId", () => {
  it("moves a repeat view to the front without duplicating", () => {
    expect(
      pushRecentlyViewedId(["listing-2", "listing-1"], "listing-1"),
    ).toEqual(["listing-1", "listing-2"]);
  });

  it("drops the oldest id after 12 views", () => {
    const ids = Array.from({ length: 12 }, (_, index) => `listing-${index}`);
    expect(pushRecentlyViewedId(ids, "listing-new")).toEqual([
      "listing-new",
      ...ids.slice(0, 11),
    ]);
  });
});

describe("selectRecentlyViewedListings", () => {
  it("skips failed ids, the current listing, and non-ACTIVE rows", () => {
    const active = listing({ id: "listing-2", product: listing().product });
    const sold = listing({
      id: "listing-sold",
      status: "SOLD",
      product: { ...listing().product, skinName: "Asiimov" },
    });
    const reserved = listing({ id: "listing-reserved", status: "RESERVED" });
    const selected = selectRecentlyViewedListings(
      [
        "listing-current",
        "listing-dead",
        "listing-sold",
        "listing-reserved",
        "listing-2",
        "listing-pending",
      ],
      new Map([
        ["listing-current", listing({ id: "listing-current" })],
        ["listing-dead", "error"],
        ["listing-sold", sold],
        ["listing-reserved", reserved],
        ["listing-2", active],
        ["listing-pending", undefined],
      ]),
      "listing-current",
    );

    expect(selected.map((item) => item.id)).toEqual(["listing-2"]);
    expect(selected.every((item) => item.status === "ACTIVE")).toBe(true);
  });

  it("does not treat SOLD as buyable", () => {
    expect(isRecentlyViewedBuyable(listing({ status: "SOLD" }))).toBe(false);
    expect(isRecentlyViewedBuyable(listing({ status: "ACTIVE" }))).toBe(true);
  });
});

describe("storage helpers", () => {
  it("round-trips ids through a mock Storage so a reload can restore them", () => {
    const storage = memoryStorage();
    expect(recordRecentlyViewedId("listing-a", storage)).toEqual(["listing-a"]);
    expect(recordRecentlyViewedId("listing-b", storage)).toEqual([
      "listing-b",
      "listing-a",
    ]);
    expect(storage.memory.has(RECENTLY_VIEWED_STORAGE_KEY)).toBe(true);
    expect(loadRecentlyViewedIds(storage)).toEqual(["listing-b", "listing-a"]);
  });

  it("keeps writes from breaking when setItem throws", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(saveRecentlyViewedIds(["listing-1"], storage)).toBe(false);
    expect(recordRecentlyViewedId("listing-1", storage)).toEqual(["listing-1"]);
  });

  it("loads empty when getItem throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
    };
    expect(loadRecentlyViewedIds(storage)).toEqual([]);
  });

  it("serializes a versioned payload", () => {
    const payload = JSON.parse(
      serializeRecentlyViewedIds(["listing-1", ""]),
    ) as {
      version: number;
      ids: string[];
    };
    expect(payload).toEqual({
      version: RECENTLY_VIEWED_STORAGE_VERSION,
      ids: ["listing-1"],
    });
  });
});
