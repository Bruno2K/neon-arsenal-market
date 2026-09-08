import { describe, expect, it } from "vitest";
import { createListingDto } from "../listings.dto.js";

const validListing = {
  productId: "product-1",
  floatValue: 0.15,
  price: 100,
};

describe("listing checkout currency", () => {
  it("defaults an omitted currency to BRL", () => {
    expect(createListingDto.parse(validListing).currency).toBe("BRL");
  });

  it("accepts explicit BRL", () => {
    expect(createListingDto.parse({ ...validListing, currency: "BRL" }).currency).toBe("BRL");
  });

  it("rejects a non-BRL listing", () => {
    expect(() => createListingDto.parse({ ...validListing, currency: "USD" })).toThrow();
  });
});
