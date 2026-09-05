import { describe, expect, it } from "vitest";
import {
  CART_CTA_IN_CART,
  formatTradeLockUntil,
  resolveListingCartCta,
  similarItemsMarketPath,
} from "../listingCartCta";

describe("resolveListingCartCta", () => {
  it("allows add when ACTIVE, unlocked, and not in the cart", () => {
    expect(
      resolveListingCartCta({ status: "ACTIVE", tradeLockUntil: null }, false),
    ).toEqual({ kind: "available", reason: null, canAdd: true });
  });

  it("uses the shared SOLD label instead of a clickable add CTA", () => {
    expect(
      resolveListingCartCta({ status: "SOLD", tradeLockUntil: null }, false),
    ).toEqual({ kind: "sold", reason: "Vendido", canAdd: false });
  });

  it("uses the shared RESERVED and CANCELED labels", () => {
    expect(
      resolveListingCartCta({ status: "RESERVED", tradeLockUntil: null }, false)
        .reason,
    ).toBe("Reservado");
    expect(
      resolveListingCartCta({ status: "CANCELED", tradeLockUntil: null }, false)
        .reason,
    ).toBe("Cancelado");
  });

  it("explains a future trade lock with a visible date", () => {
    const lockUntil = "2026-12-01T00:00:00.000Z";
    const view = resolveListingCartCta(
      { status: "ACTIVE", tradeLockUntil: lockUntil },
      false,
      Date.parse("2026-09-05T00:00:00.000Z"),
    );
    expect(view.kind).toBe("trade-lock");
    expect(view.canAdd).toBe(false);
    expect(view.reason).toBe(
      `Trade lock até ${formatTradeLockUntil(lockUntil)}`,
    );
  });

  it("explains a duplicate add as already in the cart", () => {
    expect(
      resolveListingCartCta({ status: "ACTIVE", tradeLockUntil: null }, true),
    ).toEqual({
      kind: "in-cart",
      reason: CART_CTA_IN_CART,
      canAdd: false,
    });
  });

  it("prefers listing status over in-cart when the item is no longer ACTIVE", () => {
    expect(
      resolveListingCartCta({ status: "SOLD", tradeLockUntil: null }, true)
        .kind,
    ).toBe("sold");
  });

  it("falls back to Indisponível for an unknown status", () => {
    expect(
      resolveListingCartCta(
        { status: "UNKNOWN" as "ACTIVE", tradeLockUntil: null },
        false,
      ),
    ).toEqual({ kind: "unavailable", reason: "Indisponível", canAdd: false });
  });
});

describe("similarItemsMarketPath", () => {
  it("builds a Market href filtered by the listing productId", () => {
    expect(similarItemsMarketPath("ak-redline-ft")).toBe(
      "/products?productId=ak-redline-ft",
    );
    expect(similarItemsMarketPath("  ")).toBe("/products");
  });
});
