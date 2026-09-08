import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing, Product } from "@/types/api";
import { fetchMarketListings, sortMarketListings } from "../marketListings";
import { parseMarketQuery } from "../marketQuery";

const listListings = vi.fn();
const listProducts = vi.fn();

vi.mock("@/api/listings", () => ({
  listListings: (...args: unknown[]) => listListings(...args),
}));

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    collection: "The Huntsman Collection",
    imageUrl: null,
    isStattrak: false,
    isSouvenir: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
  const product = overrides.product ?? makeProduct();
  return {
    id: "listing-1",
    productId: product.id,
    sellerId: "seller-1",
    floatValue: 0.14,
    pattern: 1,
    price: 22,
    currency: "BRL",
    status: "ACTIVE",
    tradeLockUntil: null,
    steamAssetId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    product,
    seller: {
      id: "seller-1",
      storeName: "Store",
      rating: 4.5,
      user: { id: "user-1", name: "Seller" },
    },
    ...overrides,
  };
}

describe("fetchMarketListings", () => {
  beforeEach(() => {
    listListings.mockReset();
    listProducts.mockReset();
  });

  it("lists ACTIVE listings without calling products when q is empty", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await fetchMarketListings(
      parseMarketQuery(new URLSearchParams()),
    );

    expect(listProducts).not.toHaveBeenCalled();
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
      sort: "createdAt_desc",
    });
    expect(result.items).toHaveLength(1);
  });

  it("resolves q through GET /products?search= then listings by productId", async () => {
    listProducts.mockResolvedValue({
      items: [makeProduct({ id: "talon-fade-fn", weapon: "Talon Knife" })],
      total: 1,
      page: 1,
      limit: 100,
    });
    listListings.mockResolvedValue({
      items: [
        makeListing({
          id: "listing-talon",
          productId: "talon-fade-fn",
          product: makeProduct({ id: "talon-fade-fn", weapon: "Talon Knife" }),
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await fetchMarketListings(
      parseMarketQuery(new URLSearchParams("q=talon&exterior=Factory+New")),
    );

    expect(listProducts).toHaveBeenCalledWith({ search: "talon", limit: 100 });
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
      productId: "talon-fade-fn",
      exterior: "Factory New",
      sort: "createdAt_desc",
    });
    expect(result.items[0]?.id).toBe("listing-talon");
  });

  it("returns an empty page when products search has no hits", async () => {
    listProducts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });

    const result = await fetchMarketListings(
      parseMarketQuery(new URLSearchParams("q=zzzz")),
    );

    expect(listListings).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it("merges ACTIVE listings when search matches several products", async () => {
    listProducts.mockResolvedValue({
      items: [
        makeProduct({ id: "p1", skinName: "Printstream" }),
        makeProduct({
          id: "p2",
          skinName: "Printstream",
          exterior: "Minimal Wear",
        }),
      ],
      total: 2,
      page: 1,
      limit: 100,
    });
    listListings.mockImplementation(async (params: { productId?: string }) => ({
      items: [
        makeListing({
          id: `listing-${params.productId}`,
          productId: params.productId,
          price: params.productId === "p1" ? 80 : 40,
          product: makeProduct({ id: params.productId ?? "p1" }),
        }),
      ],
      total: 1,
      page: 1,
      limit: 100,
    }));

    const result = await fetchMarketListings(
      parseMarketQuery(new URLSearchParams("q=Printstream&sort=price_asc")),
    );

    expect(listListings).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([
      "listing-p2",
      "listing-p1",
    ]);
  });
});

describe("sortMarketListings", () => {
  it("sorts by price without mutating the input", () => {
    const a = makeListing({ id: "a", price: 30 });
    const b = makeListing({ id: "b", price: 10 });
    const input = [a, b];
    expect(
      sortMarketListings(input, "price_asc").map((item) => item.id),
    ).toEqual(["b", "a"]);
    expect(input.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
