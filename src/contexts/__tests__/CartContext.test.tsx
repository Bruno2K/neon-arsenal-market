import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

function CartConsumer() {
  const {
    items,
    addItem,
    updateListing,
    removeItem,
    removeItems,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart();
  const futureLock = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return (
    <div>
      <span data-testid="count">{totalItems}</span>
      <span data-testid="price">{totalPrice.toFixed(2)}</span>
      <ul>
        {items.map((item) => (
          <li key={item.listing.id} data-testid={`item-${item.listing.id}`}>
            {item.listing.id}
          </li>
        ))}
      </ul>
      <button
        data-testid="add-ak"
        onClick={() => addItem(makeListing({ id: "listing-ak", price: 150 }))}
      >
        Add AK
      </button>
      <button
        data-testid="add-m4"
        onClick={() => addItem(makeListing({ id: "listing-m4", price: 200 }))}
      >
        Add M4
      </button>
      <button
        data-testid="add-sold"
        onClick={() =>
          addItem(
            makeListing({ id: "listing-sold", price: 50, status: "SOLD" }),
          )
        }
      >
        Add Sold
      </button>
      <button
        data-testid="add-reserved"
        onClick={() =>
          addItem(makeListing({ id: "listing-reserved", status: "RESERVED" }))
        }
      >
        Add Reserved
      </button>
      <button
        data-testid="add-canceled"
        onClick={() =>
          addItem(makeListing({ id: "listing-canceled", status: "CANCELED" }))
        }
      >
        Add Canceled
      </button>
      <button
        data-testid="add-locked"
        onClick={() =>
          addItem(
            makeListing({
              id: "listing-locked",
              status: "ACTIVE",
              tradeLockUntil: futureLock,
            }),
          )
        }
      >
        Add Locked
      </button>
      <button
        data-testid="add-string-a"
        onClick={() =>
          addItem(
            makeListing({
              id: "listing-string-a",
              price: "10.25" as unknown as number,
            }),
          )
        }
      >
        Add string A
      </button>
      <button
        data-testid="add-string-b"
        onClick={() =>
          addItem(
            makeListing({
              id: "listing-string-b",
              price: "20.50" as unknown as number,
            }),
          )
        }
      >
        Add string B
      </button>
      <button data-testid="remove-ak" onClick={() => removeItem("listing-ak")}>
        Remove AK
      </button>
      <button
        data-testid="remove-ordered"
        onClick={() => removeItems(["listing-ak"])}
      >
        Remove ordered
      </button>
      <button data-testid="clear" onClick={clearCart}>
        Clear
      </button>
      <button
        data-testid="update-ak-price"
        onClick={() =>
          updateListing(
            makeListing({ id: "listing-ak", price: 230, status: "ACTIVE" }),
          )
        }
      >
        Update AK price
      </button>
    </div>
  );
}

function renderCart() {
  return render(
    <CartProvider>
      <CartConsumer />
    </CartProvider>,
  );
}

describe("CartContext", () => {
  describe("initial state", () => {
    it("starts with empty cart", () => {
      renderCart();
      expect(screen.getByTestId("count").textContent).toBe("0");
      expect(screen.getByTestId("price").textContent).toBe("0.00");
    });
  });

  describe("addItem()", () => {
    it("adds a new item to the cart", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));

      expect(screen.getByTestId("count").textContent).toBe("1");
      expect(screen.getByTestId("item-listing-ak")).toBeTruthy();
    });

    it("does not add duplicate items (same listing ID)", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("add-ak"));

      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    it("does not add SOLD listings", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-sold"));
      expect(screen.getByTestId("count").textContent).toBe("0");
    });

    it("does not add RESERVED listings", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-reserved"));
      expect(screen.getByTestId("count").textContent).toBe("0");
    });

    it("does not add CANCELED listings", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-canceled"));
      expect(screen.getByTestId("count").textContent).toBe("0");
    });

    it("still adds an ACTIVE listing that has a future tradeLockUntil (lock is UI-only)", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-locked"));
      expect(screen.getByTestId("count").textContent).toBe("1");
      expect(screen.getByTestId("item-listing-locked")).toBeTruthy();
    });

    it("can add multiple different listings", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("add-m4"));

      expect(screen.getByTestId("count").textContent).toBe("2");
    });
  });

  describe("removeItem()", () => {
    it("removes item from cart", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("remove-ak"));

      expect(screen.getByTestId("count").textContent).toBe("0");
      expect(screen.queryByTestId("item-listing-ak")).toBeNull();
    });

    it("does nothing when removing non-existent item", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-m4"));
      fireEvent.click(screen.getByTestId("remove-ak"));

      expect(screen.getByTestId("count").textContent).toBe("1");
    });
  });

  describe("removeItems()", () => {
    it("removes only the listings that entered the order", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("add-m4"));
      fireEvent.click(screen.getByTestId("remove-ordered"));

      expect(screen.getByTestId("count").textContent).toBe("1");
      expect(screen.queryByTestId("item-listing-ak")).toBeNull();
      expect(screen.getByTestId("item-listing-m4")).toBeTruthy();
    });
  });

  describe("clearCart()", () => {
    it("empties the cart completely", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("add-m4"));
      fireEvent.click(screen.getByTestId("clear"));

      expect(screen.getByTestId("count").textContent).toBe("0");
      expect(screen.queryByTestId("item-listing-ak")).toBeNull();
      expect(screen.queryByTestId("item-listing-m4")).toBeNull();
      expect(screen.getByTestId("price").textContent).toBe("0.00");
    });
  });

  describe("totalPrice", () => {
    it("sums prices of all items", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("add-m4"));

      expect(screen.getByTestId("price").textContent).toBe("350.00");
    });

    it("sums string prices through Number()", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-string-a"));
      fireEvent.click(screen.getByTestId("add-string-b"));

      expect(screen.getByTestId("price").textContent).toBe("30.75");
    });

    it("recalculates when items are removed", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("add-m4"));
      fireEvent.click(screen.getByTestId("remove-ak"));

      expect(screen.getByTestId("price").textContent).toBe("200.00");
    });

    it("returns 0 when cart is empty", () => {
      renderCart();
      expect(screen.getByTestId("price").textContent).toBe("0.00");
    });

    it("updates an existing snapshot price without adding a new row", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak"));
      fireEvent.click(screen.getByTestId("update-ak-price"));

      expect(screen.getByTestId("count").textContent).toBe("1");
      expect(screen.getByTestId("price").textContent).toBe("230.00");
    });
  });

  describe("useCart()", () => {
    it("throws when used outside CartProvider", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<CartConsumer />);
      }).toThrow("useCart must be used within CartProvider");

      spy.mockRestore();
    });
  });
});
