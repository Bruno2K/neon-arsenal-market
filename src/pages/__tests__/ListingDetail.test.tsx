import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ListingDetail from "../ListingDetail";
import { CartProvider, useCart } from "@/contexts/CartContext";
import type { Listing, PriceHistory } from "@/types/api";
import { USER_FACING_NOT_FOUND } from "@/lib/userFacingApiError";
import {
  CART_ADDED_MESSAGE,
  CART_CTA_ADD,
  CART_CTA_IN_CART,
  CART_CTA_SIMILAR,
  CART_CTA_VIEW_CART,
} from "@/lib/listingCartCta";

const getListing = vi.fn();
const listListings = vi.fn();
const getPriceHistory = vi.fn();
const reserveListing = vi.fn();
const toast = vi.fn();

vi.mock("@/api/listings", () => ({
  getListing: (...args: unknown[]) => getListing(...args),
  listListings: (...args: unknown[]) => listListings(...args),
  reserveListing: (...args: unknown[]) => reserveListing(...args),
}));

vi.mock("@/api/price-history", () => ({
  getPriceHistory: (...args: unknown[]) => getPriceHistory(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    productId: "ak-redline-ft",
    sellerId: "seller-1",
    floatValue: 0.14501234,
    pattern: 456,
    price: 22,
    currency: "USD",
    status: "ACTIVE",
    tradeLockUntil: null,
    steamAssetId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: {
      id: "ak-redline-ft",
      game: "CS2",
      weapon: "AK-47",
      skinName: "Redline",
      rarity: "Classified",
      exterior: "Field-Tested",
      collection: "The Huntsman Collection",
      imageUrl: null,
      isStattrak: true,
      isSouvenir: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    seller: {
      id: "seller-1",
      storeName: "NeonTrader Store",
      rating: 4.5,
      user: { id: "user-1", name: "NeonTrader" },
    },
    ...overrides,
  };
}

function history(): PriceHistory[] {
  return [
    {
      id: "hist-1",
      listingId: "listing-1",
      oldPrice: 20,
      newPrice: 22,
      changedAt: "2026-08-01T00:00:00.000Z",
    },
  ];
}

function CartProbe() {
  const { totalItems } = useCart();
  return <span data-testid="cart-count">{totalItems}</span>;
}

function renderDetail(id = "listing-1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/listing/${id}`]}>
        <CartProvider>
          <Routes>
            <Route path="/listing/:id" element={<ListingDetail />} />
          </Routes>
          <CartProbe />
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ListingDetail", () => {
  beforeEach(() => {
    getListing.mockReset();
    listListings.mockReset();
    getPriceHistory.mockReset();
    reserveListing.mockReset();
    toast.mockReset();
    listListings.mockResolvedValue({ items: [], total: 0, page: 1, limit: 4 });
    getPriceHistory.mockResolvedValue([]);
  });

  it("keeps listing facts, history, related cards and add to cart", async () => {
    const related = makeListing({
      id: "listing-2",
      pattern: 789,
      price: 18.5,
    });
    getListing.mockResolvedValue(makeListing());
    getPriceHistory.mockResolvedValue(history());
    listListings.mockResolvedValue({
      items: [makeListing(), related],
      total: 2,
      page: 1,
      limit: 4,
    });

    renderDetail();

    expect(
      await screen.findByRole("heading", { name: /AK-47 \| Redline/ }),
    ).toBeTruthy();
    expect(screen.getByText("Classified")).toBeTruthy();
    expect(screen.getByText("The Huntsman Collection")).toBeTruthy();
    expect(screen.getByText("0.14501234")).toBeTruthy();
    expect(screen.getByText("456")).toBeTruthy();
    expect(screen.getAllByText("StatTrak™").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NeonTrader").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$22.00").length).toBeGreaterThan(0);
    expect(screen.getByText(/Última alteração: \$22\.00/)).toBeTruthy();
    expect(screen.getByText("Histórico de Preços")).toBeTruthy();
    expect(screen.getByText("Outros listings desta skin")).toBeTruthy();

    const addButton = screen.getAllByRole("button", {
      name: CART_CTA_ADD,
    })[0];
    expect(addButton).not.toHaveProperty("disabled", true);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
    fireEvent.click(addButton);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    expect(toast).toHaveBeenCalledWith({ title: CART_ADDED_MESSAGE });
    expect(screen.getByText(CART_ADDED_MESSAGE)).toHaveAttribute(
      "aria-live",
      "polite",
    );
    expect(reserveListing).not.toHaveBeenCalled();
    expect(screen.queryByText(/Reservado para você/)).toBeNull();
    expect(screen.queryByText(/15:00/)).toBeNull();
  });

  it("replaces the add CTA on a SOLD listing with Vendido and similar items", async () => {
    getListing.mockResolvedValue(makeListing({ status: "SOLD" }));
    renderDetail();

    expect(await screen.findByText("Status: Vendido")).toBeTruthy();
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getAllByText("Vendido").length).toBeGreaterThan(0);
    const similar = screen.getByRole("link", { name: CART_CTA_SIMILAR });
    expect(similar).toHaveAttribute("href", "/products");
    fireEvent.click(similar);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows a visible trade lock reason instead of a dimmed add button", async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    getListing.mockResolvedValue(makeListing({ tradeLockUntil: future }));
    renderDetail();

    expect(await screen.findByText("Trade Lock até")).toBeTruthy();
    expect(screen.getByText(/Trade lock até/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
  });

  it("explains a second add of the same listing as already in the cart", async () => {
    getListing.mockResolvedValue(makeListing());
    renderDetail();

    const addButton = await screen.findByRole("button", { name: CART_CTA_ADD });
    fireEvent.click(addButton);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    expect(screen.getByText(CART_CTA_IN_CART)).toBeTruthy();
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    const viewCart = screen.getByRole("link", { name: CART_CTA_VIEW_CART });
    expect(viewCart).toHaveAttribute("href", "/cart");
    fireEvent.click(viewCart);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("does not offer purchase when the listing is missing", async () => {
    getListing.mockRejectedValue(new Error("Listing not found"));
    renderDetail("missing");

    expect(await screen.findByText("Listing não encontrado")).toBeTruthy();
    expect(screen.getByText(USER_FACING_NOT_FOUND)).toBeTruthy();
    expect(screen.queryByText("Listing not found")).toBeNull();
    expect(screen.queryByText(/localhost/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).toBeNull();
    expect(screen.getByText("Voltar ao Market")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Adicionar ao Carrinho" }),
    ).toBeNull();
  });

  it("does not expose leftover SKINMARKET chrome", async () => {
    getListing.mockResolvedValue(makeListing());
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("NeonTrader")).toBeTruthy();
    });
    expect(screen.queryByText(/SKINMARKET/i)).toBeNull();
    expect(document.querySelector(".scan-lines")).toBeNull();
  });
});
