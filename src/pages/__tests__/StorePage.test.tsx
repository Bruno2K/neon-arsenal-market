import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StorePage from "../StorePage";
import { CartProvider } from "@/contexts/CartContext";
import { ApiClientError } from "@/lib/userFacingApiError";
import { SELLER_RATING_COPY } from "@/lib/storePath";
import type { Listing, Seller } from "@/types/api";

const getSellerById = vi.fn();
const listListings = vi.fn();

vi.mock("@/api/sellers", () => ({
  getSellerById: (...args: unknown[]) => getSellerById(...args),
}));

vi.mock("@/api/listings", () => ({
  listListings: (...args: unknown[]) => listListings(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function seller(): Seller {
  return {
    id: "seller-1",
    userId: "user-1",
    storeName: "RustKing",
    balance: 0,
    rating: 4.2,
    isApproved: true,
    user: { id: "user-1", name: "Rust", email: "rust@test.com" },
  };
}

function listing(): Listing {
  return {
    id: "listing-1",
    productId: "prod-1",
    sellerId: "seller-1",
    price: 10,
    currency: "USD",
    status: "ACTIVE",
    floatValue: 0.1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    seller: { id: "seller-1", storeName: "RustKing" },
  };
}

function renderStore(id = "seller-1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/stores/${id}`]}>
        <CartProvider>
          <Routes>
            <Route path="/stores/:sellerId" element={<StorePage />} />
            <Route path="/products" element={<div>market</div>} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StorePage", () => {
  beforeEach(() => {
    getSellerById.mockReset();
    listListings.mockReset();
  });

  it("loads the public store with ACTIVE listings only", async () => {
    getSellerById.mockResolvedValue(seller());
    listListings.mockResolvedValue({
      items: [listing()],
      total: 1,
      page: 1,
      limit: 40,
    });

    renderStore();

    expect(await screen.findByText("RustKing")).toBeTruthy();
    expect(screen.getByText(SELLER_RATING_COPY, { exact: false })).toBeTruthy();
    expect(screen.getByText("AK-47 | Redline (Field-Tested)")).toBeTruthy();
    expect(listListings).toHaveBeenCalledWith({
      sellerId: "seller-1",
      status: "ACTIVE",
      page: 1,
      limit: 40,
    });
    expect(screen.queryByText(/média das avaliações/i)).toBeNull();
  });

  it("shows 404 copy for a missing seller", async () => {
    getSellerById.mockRejectedValue(
      new ApiClientError("Not found", { status: 404 }),
    );

    renderStore("missing");

    expect(await screen.findByText("Loja não encontrada")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Voltar ao Market" }),
    ).toHaveAttribute("href", "/products");
    expect(listListings).not.toHaveBeenCalled();
  });
});
