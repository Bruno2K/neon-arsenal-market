import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AccountFavoritesPage from "../AccountFavorites";
import { CartProvider } from "@/contexts/CartContext";
import type { Favorite, Listing } from "@/types/api";

const listFavorites = vi.fn();

vi.mock("@/api/favorites", () => ({
  listFavorites: (...args: unknown[]) => listFavorites(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function soldFavorite(): Favorite {
  const listing: Listing = {
    id: "listing-sold",
    productId: "prod-1",
    sellerId: "seller-1",
    price: 40,
    currency: "BRL",
    status: "SOLD",
    floatValue: 0.1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    product: {
      id: "prod-1",
      game: "CS2",
      weapon: "AWP",
      skinName: "Asiimov",
      rarity: "Covert",
      exterior: "Field-Tested",
      isStattrak: false,
      isSouvenir: false,
      imageUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    seller: { id: "seller-1", storeName: "Store" },
  };
  return {
    id: "fav-1",
    userId: "u1",
    listingId: "listing-sold",
    listing,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CartProvider>
          <AccountFavoritesPage />
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AccountFavoritesPage", () => {
  beforeEach(() => {
    listFavorites.mockReset();
  });

  it("shows a Market CTA when the list is empty", async () => {
    listFavorites.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Nenhum favorito")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Explorar Market" }),
    ).toHaveAttribute("href", "/products");
  });

  it("keeps a SOLD favorite with a badge and related link", async () => {
    listFavorites.mockResolvedValue([soldFavorite()]);
    renderPage();
    expect(await screen.findAllByText("Vendido")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Ver relacionados" }),
    ).toHaveAttribute("href", "/products?productId=prod-1");
  });

  it("renders GET /favorites items that only include listingId", async () => {
    const sold = soldFavorite();
    listFavorites.mockResolvedValue([
      { listingId: sold.listingId, listing: sold.listing },
    ]);
    renderPage();
    expect(await screen.findAllByText("Vendido")).toHaveLength(2);
  });

  it("shows an error state without claiming a saved list", async () => {
    listFavorites.mockRejectedValue(new Error("forbidden"));
    renderPage();
    expect(await screen.findByText("Erro ao carregar favoritos")).toBeTruthy();
    expect(screen.queryByText("Nenhum favorito")).toBeNull();
  });
});
