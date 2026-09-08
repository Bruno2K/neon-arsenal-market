import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Products from "../Products";
import { CartProvider } from "@/contexts/CartContext";
import type { Listing } from "@/types/api";
import {
  MARKET_SIMILAR_EMPTY_DESCRIPTION,
  MARKET_SIMILAR_EMPTY_TITLE,
  MARKET_VIEW_CTA,
} from "@/lib/listingCartCta";
import { MARKET_TAXONOMY_EMPTY_HINT } from "@/lib/marketQuery";
import { CART_STORAGE_KEY } from "@/lib/cartStorage";
import {
  setAnalyticsCollector,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics";

const listListings = vi.fn();
const listProducts = vi.fn();

vi.mock("@/api/listings", () => ({
  listListings: (...args: unknown[]) => listListings(...args),
}));

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
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
    currency: "BRL",
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

function LocationEcho() {
  const [params] = useSearchParams();
  return <div data-testid="market-query">{params.toString()}</div>;
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
            <Route
              path="/products"
              element={
                <>
                  <LocationEcho />
                  <Products />
                </>
              }
            />
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
    listProducts.mockReset();
    listProducts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });
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
      sort: "createdAt_desc",
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
      sort: "createdAt_desc",
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
      sort: "createdAt_desc",
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
      sort: "createdAt_desc",
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
    expect(screen.getByTestId("market-query").textContent).toBe(
      "exterior=Factory+New",
    );
  });

  it("restores chips and page from the Market URL", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 40,
      page: 2,
      limit: 20,
    });

    renderMarket("/products?exterior=Minimal+Wear&page=2&sort=price-asc");

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Minimal Wear" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Menor Preço" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Página 2")).toBeTruthy();
    expect(listListings).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      status: "ACTIVE",
      exterior: "Minimal Wear",
      sort: "price_asc",
    });
    expect(listProducts).not.toHaveBeenCalled();
  });

  it("ignores invalid query params without crashing", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket(
      "/products?page=nope&sort=newest&exterior=Glossy&stattrak=maybe",
    );

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
      sort: "createdAt_desc",
    });
    expect(screen.getAllByRole("button", { name: "Todos" })[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("resolves textual search via GET /products and ACTIVE listings", async () => {
    listProducts.mockResolvedValue({
      items: [
        {
          id: "talon-fade-fn",
          game: "CS2",
          weapon: "Talon Knife",
          skinName: "Fade",
          rarity: "Covert",
          exterior: "Factory New",
          collection: null,
          imageUrl: null,
          isStattrak: false,
          isSouvenir: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    });
    listListings.mockResolvedValue({
      items: [
        makeListing({
          id: "listing-talon",
          productId: "talon-fade-fn",
          product: {
            id: "talon-fade-fn",
            game: "CS2",
            weapon: "Talon Knife",
            skinName: "Fade",
            rarity: "Covert",
            exterior: "Factory New",
            collection: null,
            imageUrl: null,
            isStattrak: false,
            isSouvenir: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?q=talon");

    expect(
      await screen.findByText("Talon Knife | Fade (Factory New)"),
    ).toBeTruthy();
    expect(screen.getByText("1 resultado para talon")).toBeTruthy();
    expect(screen.getByLabelText("Buscar no Market")).toHaveValue("talon");
    expect(listProducts).toHaveBeenCalledWith({ search: "talon", limit: 100 });
    expect(listListings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: "ACTIVE",
      productId: "talon-fade-fn",
      sort: "createdAt_desc",
    });
  });

  it("shows a search empty state with clear and exterior shortcuts", async () => {
    listProducts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });

    renderMarket("/products?q=zzzz");

    expect(await screen.findByText("Nenhum listing para ‘zzzz’")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Limpar busca" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Explorar Market" }),
    ).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "Factory New" })).toHaveAttribute(
      "href",
      "/products?exterior=Factory+New",
    );
    expect(listListings).not.toHaveBeenCalled();
  });

  it("debounces the Market search field into the q param", async () => {
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

    fireEvent.change(screen.getByLabelText("Buscar no Market"), {
      target: { value: "huntsman" },
    });

    await waitFor(
      () => {
        expect(screen.getByTestId("market-query").textContent).toBe(
          "q=huntsman",
        );
      },
      { timeout: 1500 },
    );
  });

  it("does not request listings when minFloat is greater than maxFloat", async () => {
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
    listListings.mockClear();

    fireEvent.change(screen.getByLabelText("Float mínimo"), {
      target: { value: "0.4" },
    });
    fireEvent.change(screen.getByLabelText("Float máximo"), {
      target: { value: "0.1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }));

    expect(
      await screen.findByText(
        "O float mínimo não pode ser maior que o máximo.",
      ),
    ).toBeTruthy();
    expect(listListings).not.toHaveBeenCalled();
  });

  it("marks the weapon chip from the URL as pressed", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?weapon=AK-47");

    expect(
      await screen.findByRole("button", { name: "AK-47" }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(listListings).toHaveBeenCalledWith(
        expect.objectContaining({ weapon: "AK-47", status: "ACTIVE" }),
      );
    });
  });

  it("combines weapon with exterior, StatTrak, and search in the URL", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?weapon=AK-47&exterior=Field-Tested&stattrak=true");
    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Buscar no Market"), {
      target: { value: "redline" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("market-query").textContent).toContain(
        "weapon=AK-47",
      );
      expect(screen.getByTestId("market-query").textContent).toContain(
        "exterior=Field-Tested",
      );
      expect(screen.getByTestId("market-query").textContent).toContain(
        "stattrak=true",
      );
      expect(screen.getByTestId("market-query").textContent).toContain(
        "q=redline",
      );
    });
  });

  it("uses Outras to focus search instead of inventing a weapon param", async () => {
    listListings.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?weapon=AK-47");
    expect(
      await screen.findByRole("button", { name: "AK-47" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Outras" }));

    await waitFor(() => {
      expect(screen.getByTestId("market-query").textContent).not.toContain(
        "weapon=",
      );
    });
    expect(screen.getByLabelText("Buscar no Market")).toHaveFocus();
  });

  it("suggests clearing weapon or rarity when those filters empty the grid", async () => {
    listListings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?weapon=AK-47&rarity=Covert");

    expect(
      await screen.findByText("Nenhum listing com estes filtros"),
    ).toBeTruthy();
    expect(
      screen.getByText(new RegExp(MARKET_TAXONOMY_EMPTY_HINT)),
    ).toBeTruthy();
  });

  it("puts weapon and rarity in the URL and listListings params", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "AK-47" }));
    fireEvent.click(screen.getByRole("button", { name: "Covert" }));

    expect(screen.getByTestId("market-query").textContent).toContain(
      "weapon=AK-47",
    );
    expect(screen.getByTestId("market-query").textContent).toContain(
      "rarity=Covert",
    );
    await waitFor(() => {
      expect(listListings).toHaveBeenCalledWith(
        expect.objectContaining({
          weapon: "AK-47",
          rarity: "Covert",
          status: "ACTIVE",
        }),
      );
    });
  });

  it("clears filters back to the default catalog URL", async () => {
    listListings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    renderMarket("/products?exterior=Field-Tested&stattrak=true");

    expect(
      await screen.findByText("Nenhum listing com estes filtros"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Limpar filtros" })[0],
    );
    expect(screen.getByTestId("market-query").textContent).toBe("");
  });
});
