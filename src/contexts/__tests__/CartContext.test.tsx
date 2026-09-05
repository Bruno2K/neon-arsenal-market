import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "../CartContext";
import type { Listing } from "@/types/api";

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    productId: "prod-1",
    sellerId: "seller-1",
    price: 150,
    currency: "USD",
    status: "ACTIVE",
    floatValue: 0.1,
    pattern: null,
    tradeLockUntil: null,
    steamAssetId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    product: {
      id: "prod-1",
      game: "CS2",
      weapon: "AWP",
      skinName: "Asiimov",
      rarity: "Covert",
      collection: "The Operation Phoenix Collection",
      exterior: "Field-Tested",
      isStattrak: false,
      isSouvenir: false,
      imageUrl: "https://example.com/awp.png",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    seller: {
      id: "seller-1",
      storeName: "Sniper Shop",
    },
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("CartContext", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it("adds an ACTIVE listing", () => {
    const listing = makeListing();
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(listing);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].listing.id).toBe("listing-1");
    expect(result.current.totalItems).toBe(1);
  });

  it("does not add the same listing id twice (unique-item cart)", () => {
    const listing = makeListing();
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(listing);
      result.current.addItem(listing);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalItems).toBe(1);
  });

  it("rejects a SOLD listing", () => {
    const listing = makeListing({ status: "SOLD" });
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(listing);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("rejects a RESERVED listing", () => {
    const listing = makeListing({ status: "RESERVED" });
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(listing);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("rejects a CANCELED listing", () => {
    const listing = makeListing({ status: "CANCELED" });
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(listing);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("still adds an ACTIVE listing that has a future tradeLockUntil (lock is UI-only)", () => {
    const listing = makeListing({
      status: "ACTIVE",
      tradeLockUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(listing);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].listing.id).toBe("listing-1");
  });

  it("adds two different listings independently", () => {
    const a = makeListing({ id: "a", price: 10 });
    const b = makeListing({ id: "b", price: 20 });
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(a);
      result.current.addItem(b);
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
  });

  it("removes an item by listing id", () => {
    const listing = makeListing();
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(listing);
      result.current.removeItem("listing-1");
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
  });

  it("removeItem is a no-op when the listing is not in the cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.removeItem("missing");
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("clears all items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeListing({ id: "a" }));
      result.current.addItem(makeListing({ id: "b" }));
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it("computes totalPrice as the sum of listing prices", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeListing({ id: "a", price: 150 }));
      result.current.addItem(makeListing({ id: "b", price: 200 }));
    });

    expect(result.current.totalPrice).toBe(350);
  });

  it("sums string prices through Number()", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(
        makeListing({ id: "a", price: "10.25" as unknown as number }),
      );
      result.current.addItem(
        makeListing({ id: "b", price: "20.50" as unknown as number }),
      );
    });

    expect(result.current.totalPrice).toBe(30.75);
  });

  it("recomputes totalPrice after remove", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeListing({ id: "a", price: 150 }));
      result.current.addItem(makeListing({ id: "b", price: 200 }));
      result.current.removeItem("a");
    });

    expect(result.current.totalPrice).toBe(200);
    expect(result.current.totalItems).toBe(1);
  });

  it("totalPrice is 0 when the cart is empty", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.totalPrice).toBe(0);
  });

  it("throws when useCart is used outside CartProvider", () => {
    expect(() => renderHook(() => useCart())).toThrow(
      "useCart must be used within CartProvider",
    );
  });
});
