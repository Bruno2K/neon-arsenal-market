import { describe, expect, it } from "vitest";
import { isSellerPath } from "../postLoginPath";

describe("isSellerPath", () => {
  it("covers every seller dashboard route", () => {
    expect(isSellerPath("/seller")).toBe(true);
    expect(isSellerPath("/seller/listings")).toBe(true);
    expect(isSellerPath("/seller/products")).toBe(true);
    expect(isSellerPath("/seller/orders")).toBe(true);
    expect(isSellerPath("/seller/transactions")).toBe(true);
  });

  it("does not treat admin or storefront paths as seller", () => {
    expect(isSellerPath("/admin")).toBe(false);
    expect(isSellerPath("/admin/orders")).toBe(false);
    expect(isSellerPath("/products")).toBe(false);
    expect(isSellerPath("/")).toBe(false);
  });
});
