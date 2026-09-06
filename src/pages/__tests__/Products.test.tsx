import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Products from "../Products";
import { CartProvider } from "@/contexts/CartContext";
import type { Listing } from "@/types/api";
import {
  MARKET_SIMILAR_EMPTY_DESCRIPTION,
  MARKET_SIMILAR_EMPTY_TITLE,
  MARKET_VIEW_CTA,
} from "@/lib/listingCartCta";
import { CART_STORAGE_KEY } from "@/lib/cartStorage";
import {
  setAnalyticsCollector,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics";

const listListings = vi.fn();

vi.mock("@/api/listings", () => ({
  listListings: (...args: unknown[]) => listListings(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
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
      isStattrak: false,
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

function renderMarket(path = "/products") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <CartProvider>
          <Routes>
            <Route path="/products" element={<Products />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const analyticsEvents: { event: AnalyticsEventName; props: AnalyticsProps }[] =
  [];

describe("Products", () => {
  beforeEach(() => {
    analyticsEvents.length = 0;
    setAnalyticsCollector((event, props) => {
      analyticsEvents.push({ event, props });
    });
    listListings.mockReset();
    localStorage.removeItem(CART_STORAGE_KEY);
  });

  afterEach(() => {
    setAnalyticsCollector(null);
  });

  it("lists ACTIVE listings without a productId filter by default", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket();

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
    });
    expect(screen.queryByText(MARKET_SIMILAR_EMPTY_TITLE)).toBeNull();
  });

  it("passes productId from the query string to listListings", async () => {
    listListings.mockResolvedValue({
      items: [makeListing({ id: "listing-2" })],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?productId=ak-redline-ft");

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
      productId: "ak-redline-ft",
    });
  });

  it("shows a skin-specific empty state when no ACTIVE listing matches productId", async () => {
    listListings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?productId=ak-redline-ft");

    expect(await screen.findByText(MARKET_SIMILAR_EMPTY_TITLE)).toBeTruthy();
    expect(screen.getByText(MARKET_SIMILAR_EMPTY_DESCRIPTION)).toBeTruthy();
    expect(screen.getByRole("link", { name: MARKET_VIEW_CTA })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.queryByText("Nenhum item encontrado")).toBeNull();
    expect(screen.queryByText("Tente ajustar os filtros")).toBeNull();
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
      productId: "ak-redline-ft",
    });
  });

  it("keeps the generic catalog empty state when productId is absent", async () => {
    listListings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    renderMarket();

    expect(await screen.findByText("Nenhum item encontrado")).toBeTruthy();
    expect(screen.getByText("Tente ajustar os filtros")).toBeTruthy();
    expect(screen.queryByText(MARKET_SIMILAR_EMPTY_TITLE)).toBeNull();
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
    });
  });

  it("tracks search and search_result_click on the market query", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?productId=ak-redline-ft");

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();

    await waitFor(() => {
      expect(analyticsEvents).toContainEqual({
        event: "search",
        props: {
          query: "productId=ak-redline-ft",
          productId: "ak-redline-ft",
          source: "market",
          resultCount: 1,
        },
      });
    });

    fireEvent.click(
      screen.getByRole("link", { name: "AK-47 | Redline (Field-Tested)" }),
    );
    expect(analyticsEvents).toContainEqual({
      event: "search_result_click",
      props: {
        listingId: "listing-1",
        productId: "ak-redline-ft",
        price: "22",
        source: "market",
      },
    });
  });

  it("tracks category_view when an exterior chip is selected", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket();
    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Factory New" }));
    expect(analyticsEvents).toContainEqual({
      event: "category_view",
      props: { category: "Factory New", source: "market" },
    });
  });
});
