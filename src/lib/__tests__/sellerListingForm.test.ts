import { describe, expect, it } from "vitest";
import type { Listing, Product } from "@/types/api";
import {
  emptyListingForm,
  listingToForm,
  parseListingForm,
  parseListingPrice,
} from "../sellerListingForm";

function product(): Product {
  return {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    isStattrak: false,
    isSouvenir: false,
    imageUrl: "https://cs2.sh/image/ak-redline.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  const catalog = product();
  return {
    id: "listing-1",
    productId: catalog.id,
    sellerId: "seller-1",
    floatValue: 0.25,
    pattern: 123,
    price: 18.5,
    currency: "BRL",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: catalog,
    seller: { id: "seller-1", storeName: "NeonTrader Store" },
    ...overrides,
  };
}

describe("parseListingForm", () => {
  it("requires a product", () => {
    expect(
      parseListingForm({
        ...emptyListingForm,
        floatValue: "0.2",
        price: "10",
      }),
    ).toEqual({ title: "Produto é obrigatório" });
  });

  it("rejects float outside 0-1", () => {
    expect(
      parseListingForm({
        ...emptyListingForm,
        productId: "ak-redline-ft",
        floatValue: "1.2",
        price: "10",
      }),
    ).toEqual({ title: "Float deve estar entre 0 e 1" });
  });

  it("rejects non-positive price", () => {
    expect(
      parseListingForm({
        ...emptyListingForm,
        productId: "ak-redline-ft",
        floatValue: "0.2",
        price: "0",
      }),
    ).toEqual({ title: "Preço inválido" });
  });

  it("rejects a negative pattern", () => {
    expect(
      parseListingForm({
        ...emptyListingForm,
        productId: "ak-redline-ft",
        floatValue: "0.2",
        price: "10",
        pattern: "-1",
      }),
    ).toEqual({ title: "Pattern inválido" });
  });

  it("parses a valid create payload", () => {
    expect(
      parseListingForm({
        ...emptyListingForm,
        productId: "ak-redline-ft",
        floatValue: "0.25",
        price: "18.5",
        pattern: "123",
      }),
    ).toEqual({
      value: { floatValue: 0.25, price: 18.5, pattern: 123 },
    });
  });
});

describe("parseListingPrice", () => {
  it("rejects invalid prices", () => {
    expect(parseListingPrice("")).toEqual({
      title: "Preço inválido",
    });
    expect(parseListingPrice("0")).toEqual({
      title: "Preço inválido",
    });
  });

  it("accepts a positive price", () => {
    expect(parseListingPrice("19.99")).toEqual({ price: 19.99 });
  });
});

describe("listingToForm", () => {
  it("maps an existing listing into the dialog form", () => {
    expect(listingToForm(listing())).toMatchObject({
      productId: "ak-redline-ft",
      floatValue: "0.25",
      pattern: "123",
      price: "18.5",
    });
  });
});
