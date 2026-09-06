import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IndexPage from "../Index";
import { CartProvider } from "@/contexts/CartContext";
import type { Listing, Product, Seller } from "@/types/api";
import { ApiClientError, USER_FACING_NETWORK } from "@/lib/userFacingApiError";
import { MARKET_VIEW_CTA, similarItemsMarketPath } from "@/lib/listingCartCta";
import {
  HOME_EMPTY_DESCRIPTION,
  HOME_EMPTY_TITLE,
  HOME_NEW_HEADING,
  HOME_NEW_SORT_COPY,
  HOME_SELLER_CTA,
  HOME_SHORTCUTS_HEADING,
  HOME_TRUST_HEADING,
  HOME_TRUST_ITEMS,
  HOME_VALUE_PROP,
  approvedSellersCountLabel,
  listingsCountLabel,
} from "@/lib/homeDiscovery";
import { CART_STORAGE_KEY } from "@/lib/cartStorage";
import {
  setAnalyticsCollector,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics";

const listListings = vi.fn();
const listProducts = vi.fn();
const listSellers = vi.fn();

vi.mock("@/api/listings", () => ({
  listListings: (...args: unknown[]) => listListings(...args),
}));

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}));

vi.mock("@/api/sellers", () => ({
  listSellers: (...args: unknown[]) => listSellers(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
  const product = overrides.product ?? makeProduct();
  return {
    id: "listing-1",
    productId: product.id,
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
    product,
    seller: {
      id: "seller-1",
      storeName: "NeonTrader Store",
      rating: 4.5,
      user: { id: "user-1", name: "NeonTrader" },
    },
    ...overrides,
  };
}

function makeSeller(overrides: Partial<Seller> = {}): Seller {
  return {
    id: "seller-1",
    userId: "user-1",
    storeName: "NeonTrader Store",
    balance: 0,
    rating: 4.5,
    isApproved: true,
    ...overrides,
  };
}

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <CartProvider>
          <Routes>
            <Route path="/" element={<IndexPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const analyticsEvents: { event: AnalyticsEventName; props: AnalyticsProps }[] =
  [];

describe("Index", () => {
  beforeEach(() => {
    analyticsEvents.length = 0;
    setAnalyticsCollector((event, props) => {
      analyticsEvents.push({ event, props });
    });
    localStorage.removeItem(CART_STORAGE_KEY);
    listListings.mockReset();
    listProducts.mockReset();
    listSellers.mockReset();
    listProducts.mockResolvedValue({
      items: [
        makeProduct(),
        makeProduct({
          id: "awp-asiimov-ft",
          weapon: "AWP",
          skinName: "Asiimov",
        }),
      ],
      total: 2,
      page: 1,
      limit: 24,
    });
    listSellers.mockResolvedValue([
      makeSeller(),
      makeSeller({ id: "seller-2", userId: "user-2" }),
    ]);
  });

  afterEach(() => {
    setAnalyticsCollector(null);
  });

  it("renders discovery home instead of only eight cards and one button", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 12,
      page: 1,
      limit: 8,
    });

    renderHome();

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    expect(screen.getByText(HOME_VALUE_PROP)).toBeTruthy();
    expect(screen.getByText(HOME_NEW_HEADING)).toBeTruthy();
    expect(screen.getByText(HOME_NEW_SORT_COPY)).toBeTruthy();
    expect(screen.getByText(HOME_SHORTCUTS_HEADING)).toBeTruthy();
    expect(screen.getByText(HOME_TRUST_HEADING)).toBeTruthy();
    for (const item of HOME_TRUST_ITEMS) {
      expect(screen.getByText(item)).toBeTruthy();
    }
    expect(screen.getByText(listingsCountLabel(12))).toBeTruthy();
    expect(screen.getByText(approvedSellersCountLabel(2))).toBeTruthy();

    const marketLinks = screen.getAllByRole("link", { name: MARKET_VIEW_CTA });
    expect(marketLinks.length).toBeGreaterThan(1);
    expect(marketLinks[0]).toHaveAttribute("href", "/products");

    expect(
      screen.getByRole("link", { name: "AK-47 | Redline" }),
    ).toHaveAttribute("href", similarItemsMarketPath("ak-redline-ft"));
    expect(screen.getByRole("link", { name: "AWP | Asiimov" })).toHaveAttribute(
      "href",
      similarItemsMarketPath("awp-asiimov-ft"),
    );
    expect(screen.queryByRole("link", { name: /#/ })).toBeNull();

    const sellerCtas = screen.getAllByRole("link", { name: HOME_SELLER_CTA });
    expect(sellerCtas[0]).toHaveAttribute("href", "/register");

    expect(screen.queryByText("Em destaque")).toBeNull();
    expect(screen.queryByText("Continue de onde parou")).toBeNull();
    expect(screen.queryByText(/Oito em destaque/i)).toBeNull();
    expect(document.querySelector(".scan-lines")).toBeNull();
    expect(document.querySelector(".neon-text")).toBeNull();

    expect(listListings).toHaveBeenCalledWith({ status: "ACTIVE", limit: 8 });
    expect(listSellers).toHaveBeenCalledWith({ approved: true });
    expect(screen.getAllByText("AK-47 | Redline (Field-Tested)")).toHaveLength(
      1,
    );
  });

  it("keeps the hero visible and retries listings on error", async () => {
    listListings
      .mockRejectedValueOnce(
        new ApiClientError(
          "Could not reach API at http://localhost:3001/listings: Failed to fetch",
          { code: "NETWORK" },
        ),
      )
      .mockResolvedValueOnce({
        items: [makeListing()],
        total: 1,
        page: 1,
        limit: 8,
      });

    renderHome();

    expect(await screen.findByText("Erro ao carregar listings")).toBeTruthy();
    expect(screen.getByText(USER_FACING_NETWORK)).toBeTruthy();
    expect(screen.getByText("Neon Arsenal")).toBeTruthy();
    expect(screen.getByText(HOME_VALUE_PROP)).toBeTruthy();
    expect(screen.queryByText(/localhost/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
  });

  it("explains an empty catalog and points to seller registration", async () => {
    listListings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 8,
    });

    renderHome();

    expect(await screen.findByText(HOME_EMPTY_TITLE)).toBeTruthy();
    expect(screen.getByText(HOME_EMPTY_DESCRIPTION)).toBeTruthy();
    expect(screen.getByText(listingsCountLabel(0))).toBeTruthy();
    const emptySeller = screen.getAllByRole("link", { name: HOME_SELLER_CTA });
    expect(
      emptySeller.some((link) => link.getAttribute("href") === "/register"),
    ).toBe(true);
    expect(screen.queryByText("Em destaque")).toBeNull();
  });

  it("shows listing rail skeletons while the catalog loads", async () => {
    let resolveListings: (value: unknown) => void = () => undefined;
    listListings.mockReturnValue(
      new Promise((resolve) => {
        resolveListings = resolve;
      }),
    );

    renderHome();

    expect(screen.getByLabelText("Carregando")).toBeTruthy();
    expect(screen.getByText("Neon Arsenal")).toBeTruthy();

    resolveListings({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 8,
    });

    await waitFor(() => {
      expect(screen.getByText("AK-47 | Redline (Field-Tested)")).toBeTruthy();
    });
  });

  it("tracks category_view when a home catalog chip is used", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 8,
    });

    renderHome();
    fireEvent.click(
      await screen.findByRole("link", { name: "AK-47 | Redline" }),
    );

    expect(analyticsEvents).toContainEqual({
      event: "category_view",
      props: { productId: "ak-redline-ft", source: "home" },
    });
  });
});
