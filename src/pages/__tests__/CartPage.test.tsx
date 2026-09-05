import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CartPage from "../CartPage";
import type { Listing } from "@/types/api";
import { PRE_ORDER_HOLD_COPY } from "@/lib/orderPaymentView";

const getListing = vi.fn();
const reserveListing = vi.fn();

const cartState = {
  items: [] as { listing: Listing; priceWhenAdded?: Listing["price"] }[],
  totalPrice: 0,
  totalItems: 0,
  removeItem: vi.fn(),
  updateListing: vi.fn(),
};

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => cartState,
}));

vi.mock("@/api/listings", () => ({
  getListing: (...args: unknown[]) => getListing(...args),
  reserveListing: (...args: unknown[]) => reserveListing(...args),
}));

function listing(
  id: string,
  price: number,
  overrides: Partial<Listing> = {},
): Listing {
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
      skinName: "Neon Rider",
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
    ...overrides,
  } as Listing;
}

function renderCart() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CartPage", () => {
  beforeEach(() => {
    cartState.items = [];
    cartState.totalPrice = 0;
    cartState.totalItems = 0;
    cartState.removeItem.mockReset();
    cartState.updateListing.mockReset();
    getListing.mockReset();
    reserveListing.mockReset();
    getListing.mockImplementation(async (id: string) => {
      const found = cartState.items.find((item) => item.listing.id === id);
      if (!found) throw new Error("Listing not found");
      return found.listing;
    });
  });

  it("shows empty cart and a Market link", () => {
    renderCart();
    expect(screen.getByText("Carrinho vazio")).toBeTruthy();
    expect(screen.getByText("Explorar Market")).toBeTruthy();
    expect(screen.queryByText("Finalizar compra")).toBeNull();
  });

  it("keeps 5% service fee display math", async () => {
    cartState.items = [
      { listing: listing("listing-ak", 100), priceWhenAdded: 100 },
    ];
    cartState.totalPrice = 100;
    cartState.totalItems = 1;
    renderCart();
    expect(await screen.findByText("Finalizar compra")).toBeTruthy();
    expect(screen.getAllByText("$100.00").length).toBe(2);
    expect(screen.getByText("$5.00")).toBeTruthy();
    expect(screen.getByText("$105.00")).toBeTruthy();
    expect(screen.getByText(PRE_ORDER_HOLD_COPY)).toBeTruthy();
    expect(screen.queryByText(/Reservado para você/)).toBeNull();
    expect(screen.queryByText(/15:00/)).toBeNull();
    expect(screen.queryByText("SKINMARKET")).toBeNull();
    expect(reserveListing).not.toHaveBeenCalled();
  });

  it("does not claim the listing is held in the cart", async () => {
    cartState.items = [
      { listing: listing("listing-ak", 100), priceWhenAdded: 100 },
    ];
    cartState.totalPrice = 100;
    cartState.totalItems = 1;
    renderCart();
    expect(await screen.findByText("Finalizar compra")).toBeTruthy();
    expect(screen.getByText(PRE_ORDER_HOLD_COPY)).toBeTruthy();
    expect(screen.getByText(/não segura o item/i)).toBeTruthy();
    expect(screen.queryByText(/Reservado para você/)).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("blocks checkout when the listing is SOLD on the server", async () => {
    cartState.items = [
      { listing: listing("listing-ak", 100), priceWhenAdded: 100 },
    ];
    cartState.totalPrice = 100;
    cartState.totalItems = 1;
    getListing.mockResolvedValue(
      listing("listing-ak", 100, { status: "SOLD" }),
    );

    renderCart();

    expect(
      (
        await screen.findAllByText(
          "AK-47 | Neon Rider não está mais disponível",
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Finalizar compra" }),
    ).toBeDisabled();
    expect(reserveListing).not.toHaveBeenCalled();
  });

  it("shows a price change before checkout", async () => {
    cartState.items = [
      { listing: listing("listing-ak", 210), priceWhenAdded: 210 },
    ];
    cartState.totalPrice = 210;
    cartState.totalItems = 1;
    getListing.mockResolvedValue(listing("listing-ak", 230));

    renderCart();

    expect(
      await screen.findByText("Preço atualizado: $210.00 → $230.00"),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Finalizar compra" })).toBeTruthy();
    expect(cartState.updateListing).toHaveBeenCalled();
  });

  it("keeps a successful line visible when another listing fetch fails", async () => {
    cartState.items = [
      { listing: listing("listing-ak", 100), priceWhenAdded: 100 },
      {
        listing: listing("listing-awp", 50, {
          product: {
            ...listing("listing-awp", 50).product,
            weapon: "AWP",
            skinName: "Asiimov",
          },
        }),
        priceWhenAdded: 50,
      },
    ];
    cartState.totalPrice = 150;
    cartState.totalItems = 2;
    getListing.mockImplementation(async (id: string) => {
      if (id === "listing-ak") throw new Error("network");
      return listing("listing-awp", 50, {
        product: {
          ...listing("listing-awp", 50).product,
          weapon: "AWP",
          skinName: "Asiimov",
        },
      });
    });

    renderCart();

    expect(await screen.findByText(/AWP \| Asiimov/)).toBeTruthy();
    expect(screen.getByText("Erro ao atualizar")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Finalizar compra" }),
    ).toBeDisabled();

    getListing.mockImplementation(async (id: string) => {
      if (id === "listing-ak") return listing("listing-ak", 100);
      return listing("listing-awp", 50, {
        product: {
          ...listing("listing-awp", 50).product,
          weapon: "AWP",
          skinName: "Asiimov",
        },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Finalizar compra" }),
      ).toBeTruthy();
    });
    expect(screen.queryByText("Erro ao atualizar")).toBeNull();
  });
});
