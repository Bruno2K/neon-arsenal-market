import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CartPage from "../CartPage";
import type { Listing } from "@/types/api";

const cartState = {
  items: [] as { listing: Listing }[],
  totalPrice: 0,
  totalItems: 0,
  removeItem: vi.fn(),
};

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => cartState,
}));

function listing(id: string, price: number): Listing {
  return {
    id,
    productId: "prod-1",
    sellerId: "seller-1",
    floatValue: 0.12345678 as unknown as Listing["floatValue"],
    price: price as unknown as Listing["price"],
    currency: "USD",
    status: "ACTIVE",
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
    pattern: 123,
  } as Listing;
}

function renderCart() {
  return render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>,
  );
}

describe("CartPage", () => {
  beforeEach(() => {
    cartState.items = [];
    cartState.totalPrice = 0;
    cartState.totalItems = 0;
    cartState.removeItem.mockReset();
  });

  it("shows empty cart and a Market link", () => {
    renderCart();
    expect(screen.getByText("Carrinho vazio")).toBeTruthy();
    expect(screen.getByText("Explorar Market")).toBeTruthy();
    expect(screen.queryByText("Finalizar compra")).toBeNull();
  });

  it("keeps 5% service fee display math", () => {
    cartState.items = [{ listing: listing("listing-ak", 100) }];
    cartState.totalPrice = 100;
    cartState.totalItems = 1;
    renderCart();
    expect(screen.getAllByText("$100.00").length).toBe(2);
    expect(screen.getByText("$5.00")).toBeTruthy();
    expect(screen.getByText("$105.00")).toBeTruthy();
    expect(screen.getByText("Finalizar compra")).toBeTruthy();
    expect(screen.queryByText("SKINMARKET")).toBeNull();
  });
});
