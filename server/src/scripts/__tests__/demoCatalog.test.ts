import { describe, expect, it } from "vitest";
import {
  DEMO_LISTING_STATUSES,
  DEMO_PRODUCTS,
  DEMO_USERS,
  assertDemoCatalog,
  getDemoListings,
  listingId,
  listingPrice,
} from "../demoCatalog.js";

describe("demoCatalog", () => {
  it("keeps products, accounts and listings internally consistent", () => {
    expect(() => assertDemoCatalog()).not.toThrow();
  });

  it("exposes enough catalog variety for marketplace testing", () => {
    const listings = getDemoListings();
    const statuses = new Set(listings.map((listing) => listing.status));
    const approvedSellers = DEMO_USERS.filter((user) => user.seller?.isApproved);
    const pendingSellers = DEMO_USERS.filter((user) => user.seller && !user.seller.isApproved);
    const buyers = DEMO_USERS.filter((user) => user.role === "CUSTOMER");

    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(40);
    expect(listings.length).toBeGreaterThanOrEqual(80);
    expect(approvedSellers).toHaveLength(3);
    expect(pendingSellers).toHaveLength(1);
    expect(buyers.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_USERS.some((user) => user.role === "ADMIN")).toBe(true);

    for (const status of DEMO_LISTING_STATUSES) {
      expect(statuses.has(status)).toBe(true);
    }
  });

  it("keeps listing identities and prices stable", () => {
    const listings = getDemoListings();
    const ids = listings.map(listingId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("listing-ak-redline-ft-123");

    const product = DEMO_PRODUCTS.find((item) => item.id === "ak-redline-ft");
    const listing = listings.find((item) => item.pattern === 456);
    expect(product).toBeDefined();
    expect(listing).toBeDefined();
    expect(listingPrice(product!, listing!)).toBe("22.00");
  });
});
