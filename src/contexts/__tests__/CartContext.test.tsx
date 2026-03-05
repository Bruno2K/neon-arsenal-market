import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CartProvider, useCart } from "../CartContext";
import type { Listing } from "@/types/api";

// Helper component to expose cart state
function CartConsumer() {
  const { items, addItem, removeItem, clearCart, totalItems, totalPrice } = useCart();
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
      <button data-testid="add-ak" onClick={() => addItem(makeListing("listing-ak", 150))}>
        Add AK
      </button>
      <button data-testid="add-m4" onClick={() => addItem(makeListing("listing-m4", 200))}>
        Add M4
      </button>
      <button
        data-testid="add-inactive"
        onClick={() => addItem(makeListing("listing-inactive", 50, "SOLD"))}
      >
        Add Inactive
      </button>
      <button data-testid="remove-ak" onClick={() => removeItem("listing-ak")}>
        Remove AK
      </button>
      <button data-testid="clear" onClick={clearCart}>
        Clear
      </button>
    </div>
  );
}

function makeListing(id: string, price: number, status = "ACTIVE"): Listing {
  return {
    id,
    productId: "prod-1",
    sellerId: "seller-1",
    floatValue: 0.15 as unknown as import("@prisma/client/runtime/library").Decimal,
    price: price as unknown as import("@prisma/client/runtime/library").Decimal,
    currency: "USD",
    status,
    tradeLockUntil: null,
    steamAssetId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: {
      id: "prod-1",
      game: "CS2",
      weapon: "AK-47",
      skinName: "Redline",
      rarity: "Classified",
      exterior: "Field-Tested",
      imageUrl: null,
      isStattrak: false,
      isSouvenir: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    seller: { id: "seller-1", storeName: "Store Alpha" },
  } as unknown as Listing;
}

function renderCart() {
  return render(
    <CartProvider>
      <CartConsumer />
    </CartProvider>
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
      fireEvent.click(screen.getByTestId("add-ak")); // duplicate

      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    it("does not add non-ACTIVE listings", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-inactive"));

      expect(screen.getByTestId("count").textContent).toBe("0");
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
      fireEvent.click(screen.getByTestId("remove-ak")); // listing-ak not in cart

      expect(screen.getByTestId("count").textContent).toBe("1");
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
    });
  });

  describe("totalPrice", () => {
    it("sums prices of all items", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak")); // $150
      fireEvent.click(screen.getByTestId("add-m4")); // $200

      expect(screen.getByTestId("price").textContent).toBe("350.00");
    });

    it("recalculates when items are removed", () => {
      renderCart();
      fireEvent.click(screen.getByTestId("add-ak")); // $150
      fireEvent.click(screen.getByTestId("add-m4")); // $200
      fireEvent.click(screen.getByTestId("remove-ak")); // remove $150

      expect(screen.getByTestId("price").textContent).toBe("200.00");
    });

    it("returns 0 when cart is empty", () => {
      renderCart();
      expect(screen.getByTestId("price").textContent).toBe("0.00");
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
