import { describe, expect, it } from "vitest";
import {
  CHECKOUT_BUYER_ONLY_COPY,
  fromPathFromState,
  homePathForRole,
  normalizeInternalPath,
  postLoginPath,
} from "../postLoginPath";

describe("homePathForRole", () => {
  it("maps each role to its home surface", () => {
    expect(homePathForRole("CUSTOMER")).toBe("/");
    expect(homePathForRole("SELLER")).toBe("/seller");
    expect(homePathForRole("ADMIN")).toBe("/admin");
  });
});

describe("fromPathFromState", () => {
  it("reads pathname from a Location-like from object", () => {
    expect(fromPathFromState({ from: { pathname: "/seller/listings" } })).toBe(
      "/seller/listings",
    );
  });

  it("accepts a bare from string", () => {
    expect(fromPathFromState({ from: "/checkout" })).toBe("/checkout");
  });

  it("returns undefined when from is missing", () => {
    expect(fromPathFromState(undefined)).toBeUndefined();
    expect(fromPathFromState({})).toBeUndefined();
  });
});

describe("normalizeInternalPath", () => {
  it("treats empty, login and external values as home", () => {
    expect(normalizeInternalPath(undefined)).toBe("/");
    expect(normalizeInternalPath("")).toBe("/");
    expect(normalizeInternalPath("/login")).toBe("/");
    expect(normalizeInternalPath("/register")).toBe("/");
    expect(normalizeInternalPath("//evil.example")).toBe("/");
    expect(normalizeInternalPath("https://evil.example")).toBe("/");
  });

  it("strips query, hash and trailing slashes", () => {
    expect(normalizeInternalPath("/seller/listings/?x=1#top")).toBe(
      "/seller/listings",
    );
  });
});

describe("postLoginPath", () => {
  it("sends admin without from to /admin", () => {
    expect(postLoginPath("ADMIN").path).toBe("/admin");
    expect(postLoginPath("ADMIN", "/").path).toBe("/admin");
    expect(postLoginPath("ADMIN", "").path).toBe("/admin");
  });

  it("sends admin away from seller routes to /admin", () => {
    expect(postLoginPath("ADMIN", "/seller").path).toBe("/admin");
    expect(postLoginPath("ADMIN", "/seller/listings").path).toBe("/admin");
    expect(postLoginPath("ADMIN", "/seller/products").path).toBe("/admin");
    expect(postLoginPath("ADMIN", "/seller/orders").path).toBe("/admin");
  });

  it("sends seller without from to /seller", () => {
    expect(postLoginPath("SELLER").path).toBe("/seller");
    expect(postLoginPath("SELLER", "/").path).toBe("/seller");
  });

  it("keeps a seller on a seller from path", () => {
    expect(postLoginPath("SELLER", "/seller/listings").path).toBe(
      "/seller/listings",
    );
  });

  it("sends customer with from=/checkout to /checkout", () => {
    expect(postLoginPath("CUSTOMER", "/checkout")).toEqual({
      path: "/checkout",
    });
  });

  it("sends customer without from to home", () => {
    expect(postLoginPath("CUSTOMER").path).toBe("/");
  });

  it("blocks checkout for non-customers and explains why", () => {
    expect(postLoginPath("SELLER", "/checkout")).toEqual({
      path: "/seller",
      notice: CHECKOUT_BUYER_ONLY_COPY,
    });
    expect(postLoginPath("ADMIN", "/checkout")).toEqual({
      path: "/admin",
      notice: CHECKOUT_BUYER_ONLY_COPY,
    });
  });

  it("does not treat ADMIN as a seller home", () => {
    expect(postLoginPath("ADMIN", "/seller/products").path).not.toMatch(
      /^\/seller/,
    );
  });
});
