import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ListingDetail from "../ListingDetail";
import { CartProvider, useCart } from "@/contexts/CartContext";
import type { Listing, PriceHistory, Review, User } from "@/types/api";
import {
  ApiClientError,
  USER_FACING_NOT_FOUND,
  USER_FACING_REVIEW_EXISTS,
} from "@/lib/userFacingApiError";
import {
  CART_ADDED_MESSAGE,
  CART_CTA_ADD,
  CART_CTA_IN_CART,
  CART_CTA_SIMILAR,
  CART_CTA_VIEW_CART,
} from "@/lib/listingCartCta";
import { CART_STORAGE_KEY } from "@/lib/cartStorage";
import {
  RECENTLY_VIEWED_HEADING,
  RECENTLY_VIEWED_STORAGE_KEY,
  loadRecentlyViewedIds,
  saveRecentlyViewedIds,
} from "@/lib/recentlyViewed";
import {
  setAnalyticsCollector,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics";
import {
  PRODUCT_REVIEWS_DELETE,
  PRODUCT_REVIEWS_EMPTY,
  PRODUCT_REVIEWS_HEADING,
  PRODUCT_REVIEWS_LOGIN_CTA,
  PRODUCT_REVIEWS_SCOPE,
  PRODUCT_REVIEWS_SUBMIT,
} from "@/components/ProductReviews";
import { marketPath } from "@/lib/marketQuery";

const getListing = vi.fn();
const listListings = vi.fn();
const getPriceHistory = vi.fn();
const reserveListing = vi.fn();
const listProductReviews = vi.fn();
const createReview = vi.fn();
const updateReview = vi.fn();
const deleteReview = vi.fn();
const toast = vi.fn();

const authState = {
  user: null as User | null,
  isAuthenticated: false,
  isLoading: false,
};

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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  useOptionalAuth: () => authState,
}));

vi.mock("@/api/reviews", () => ({
  listProductReviews: (...args: unknown[]) => listProductReviews(...args),
  createReview: (...args: unknown[]) => createReview(...args),
  updateReview: (...args: unknown[]) => updateReview(...args),
  deleteReview: (...args: unknown[]) => deleteReview(...args),
}));

vi.mock("@/api/favorites", () => ({
  listFavorites: () => Promise.resolve([]),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
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

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "rev-1",
    productId: "ak-redline-ft",
    userId: "buyer-1",
    rating: 4,
    comment: "Float honesto, entrega rápida.",
    createdAt: "2026-08-15T12:00:00.000Z",
    user: { id: "buyer-1", name: "Ana" },
    ...overrides,
  };
}

function CartProbe() {
  const { totalItems } = useCart();
  return <span data-testid="cart-count">{totalItems}</span>;
}

const analyticsEvents: { event: AnalyticsEventName; props: AnalyticsProps }[] =
  [];

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
    analyticsEvents.length = 0;
    setAnalyticsCollector((event, props) => {
      analyticsEvents.push({ event, props });
    });
    getListing.mockReset();
    listListings.mockReset();
    getPriceHistory.mockReset();
    reserveListing.mockReset();
    listProductReviews.mockReset();
    createReview.mockReset();
    updateReview.mockReset();
    deleteReview.mockReset();
    toast.mockReset();
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
    sessionStorage.clear();
    listListings.mockResolvedValue({ items: [], total: 0, page: 1, limit: 4 });
    getPriceHistory.mockResolvedValue([]);
    listProductReviews.mockResolvedValue([]);
  });

  afterEach(() => {
    setAnalyticsCollector(null);
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
    expect(screen.getByText("Histórico de preços deste listing")).toBeTruthy();
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
    expect(screen.queryByText(/preço de mercado Steam/i)).toBeNull();
  });

  it("shows an explicit empty price history", async () => {
    getListing.mockResolvedValue(makeListing());
    getPriceHistory.mockResolvedValue([]);
    renderDetail();
    expect(
      await screen.findByText("Sem alterações de preço ainda"),
    ).toBeTruthy();
  });

  it("links breadcrumbs and attributes to existing Market query routes", async () => {
    const listing = makeListing();
    getListing.mockResolvedValue(listing);
    renderDetail();

    const crumbs = await screen.findByRole("navigation", {
      name: "breadcrumb",
    });
    expect(within(crumbs).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      within(crumbs).getByRole("link", { name: "Market" }),
    ).toHaveAttribute("href", "/products");
    expect(within(crumbs).getByRole("link", { name: "AK-47" })).toHaveAttribute(
      "href",
      marketPath({ weapon: "AK-47" }),
    );
    expect(
      within(crumbs).getByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();

    expect(
      screen.getByRole("link", { name: "The Huntsman Collection" }),
    ).toHaveAttribute("href", marketPath({ q: "The Huntsman Collection" }));
    expect(screen.getByRole("link", { name: "Classified" })).toHaveAttribute(
      "href",
      marketPath({ rarity: "Classified" }),
    );
    expect(
      screen
        .getAllByRole("link", { name: "AK-47" })
        .every(
          (link) =>
            link.getAttribute("href") === marketPath({ weapon: "AK-47" }),
        ),
    ).toBe(true);
  });

  it("falls back to same-weapon listings and a seller rail with honest headings", async () => {
    getListing.mockResolvedValue(makeListing());
    const otherWeapon = makeListing({
      id: "listing-weapon",
      productId: "ak-other",
      product: {
        ...makeListing().product,
        id: "ak-other",
        skinName: "Slate",
      },
    });
    const sellerOther = makeListing({
      id: "listing-seller",
      productId: "m4",
      sellerId: "seller-1",
      product: {
        ...makeListing().product,
        id: "m4",
        weapon: "M4A4",
        skinName: "Howl",
        collection: "Other",
      },
    });
    listListings.mockImplementation(
      async (params: {
        productId?: string;
        sellerId?: string;
        weapon?: string;
      }) => {
        if (params.productId) {
          return { items: [makeListing()], total: 1, page: 1, limit: 5 };
        }
        if (params.sellerId) {
          return { items: [sellerOther], total: 1, page: 1, limit: 5 };
        }
        if (params.weapon) {
          return { items: [otherWeapon], total: 1, page: 1, limit: 8 };
        }
        return { items: [], total: 0, page: 1, limit: 4 };
      },
    );

    renderDetail();

    expect(
      await screen.findByText("Outros listings desta coleção"),
    ).toBeTruthy();
    expect(screen.getByText("Mais de NeonTrader Store")).toBeTruthy();
    expect(screen.queryByText(/recomendado para você/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Ver loja" })).toHaveAttribute(
      "href",
      "/stores/seller-1",
    );
  });

  it("replaces the add CTA on a SOLD listing with Vendido and similar items", async () => {
    getListing.mockResolvedValue(makeListing({ status: "SOLD" }));
    renderDetail();

    expect(await screen.findByText("Status: Vendido")).toBeTruthy();
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getAllByText("Vendido").length).toBeGreaterThan(0);
    const similar = screen.getByRole("link", { name: CART_CTA_SIMILAR });
    expect(similar).toHaveAttribute(
      "href",
      "/products?productId=ak-redline-ft",
    );
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

  it("loads product reviews from GET /reviews/product/:productId and does not call seller.rating a review average", async () => {
    getListing.mockResolvedValue(makeListing());
    listProductReviews.mockResolvedValue([makeReview()]);

    renderDetail();

    expect(
      await screen.findByRole("heading", { name: PRODUCT_REVIEWS_HEADING }),
    ).toBeTruthy();
    expect(screen.getByText(PRODUCT_REVIEWS_SCOPE)).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Float honesto, entrega rápida.")).toBeTruthy();
    expect(
      screen.getByText(
        /Nota da loja \(campo do vendedor, não média de avaliações\): 4\.5/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/média das avaliações/i)).toBeNull();
    expect(listProductReviews).toHaveBeenCalledWith("ak-redline-ft");
  });

  it("shows empty copy and a login invite for guests, without the review form", async () => {
    getListing.mockResolvedValue(makeListing());
    renderDetail();

    expect(await screen.findByText(PRODUCT_REVIEWS_EMPTY)).toBeTruthy();
    const login = screen.getByRole("link", { name: PRODUCT_REVIEWS_LOGIN_CTA });
    expect(login).toHaveAttribute("href", "/login");
    expect(
      screen.queryByRole("button", { name: PRODUCT_REVIEWS_SUBMIT }),
    ).toBeNull();
    expect(screen.queryByLabelText("Comentário (opcional)")).toBeNull();
  });

  it("lets a CUSTOMER create a review and then switch to edit after success", async () => {
    authState.user = {
      id: "buyer-1",
      name: "Ana",
      email: "ana@test.com",
      role: "CUSTOMER",
    };
    authState.isAuthenticated = true;
    getListing.mockResolvedValue(makeListing());
    listProductReviews
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeReview()]);
    createReview.mockResolvedValue(makeReview());

    renderDetail();

    expect(await screen.findByText(PRODUCT_REVIEWS_EMPTY)).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: PRODUCT_REVIEWS_LOGIN_CTA }),
    ).toBeNull();
    const submit = screen.getByRole("button", { name: PRODUCT_REVIEWS_SUBMIT });
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("radio", { name: "4 estrelas" }));
    fireEvent.change(screen.getByLabelText("Comentário (opcional)"), {
      target: { value: "Float honesto, entrega rápida." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: PRODUCT_REVIEWS_SUBMIT }),
    );

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith({
        productId: "ak-redline-ft",
        rating: 4,
        comment: "Float honesto, entrega rápida.",
      });
    });
    expect(
      await screen.findByRole("button", { name: PRODUCT_REVIEWS_DELETE }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: PRODUCT_REVIEWS_SUBMIT }),
    ).toBeNull();
  });

  it("maps POST 409 unique conflict to você já avaliou", async () => {
    authState.user = {
      id: "buyer-1",
      name: "Ana",
      email: "ana@test.com",
      role: "CUSTOMER",
    };
    authState.isAuthenticated = true;
    getListing.mockResolvedValue(makeListing());
    createReview.mockRejectedValue(
      new ApiClientError("You already reviewed this product", { status: 409 }),
    );

    renderDetail();

    fireEvent.click(await screen.findByRole("radio", { name: "4 estrelas" }));
    fireEvent.click(
      screen.getByRole("button", { name: PRODUCT_REVIEWS_SUBMIT }),
    );

    expect(await screen.findByText(USER_FACING_REVIEW_EXISTS)).toBeTruthy();
    expect(USER_FACING_REVIEW_EXISTS.toLowerCase()).toContain(
      "você já avaliou",
    );
  });

  it("retries a failed reviews list without inventing seller review aggregation", async () => {
    getListing.mockResolvedValue(makeListing());
    listProductReviews.mockRejectedValue(
      new ApiClientError("Internal server error.", { status: 500 }),
    );

    renderDetail();

    expect(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    ).toBeTruthy();
    expect(screen.queryByText(/média das avaliações/i)).toBeNull();
    listProductReviews.mockResolvedValue([makeReview()]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Ana")).toBeTruthy();
  });

  it("tracks product_view without PII when the listing loads", async () => {
    getListing.mockResolvedValue(makeListing());
    renderDetail();

    await waitFor(() => {
      expect(analyticsEvents).toContainEqual({
        event: "product_view",
        props: {
          listingId: "listing-1",
          productId: "ak-redline-ft",
          price: "22",
        },
      });
    });
    expect(JSON.stringify(analyticsEvents)).not.toMatch(/NeonTrader|Ana|@/);
  });

  it("records the current listing and shows earlier ACTIVE views only", async () => {
    saveRecentlyViewedIds(["listing-seen", "listing-1", "listing-sold"]);
    getListing.mockImplementation(async (id: unknown) => {
      if (id === "listing-1") return makeListing();
      if (id === "listing-seen") {
        return makeListing({
          id: "listing-seen",
          productId: "awp-asiimov-ft",
          product: {
            ...makeListing().product,
            id: "awp-asiimov-ft",
            weapon: "AWP",
            skinName: "Asiimov",
          },
        });
      }
      if (id === "listing-sold") {
        return makeListing({
          id: "listing-sold",
          status: "SOLD",
          productId: "m4-howl",
          product: {
            ...makeListing().product,
            id: "m4-howl",
            weapon: "M4A4",
            skinName: "Howl",
          },
        });
      }
      throw new Error("gone");
    });

    renderDetail();

    expect(
      await screen.findByRole("heading", { name: /AK-47 \| Redline/ }),
    ).toBeTruthy();
    expect(await screen.findByText(RECENTLY_VIEWED_HEADING)).toBeTruthy();
    expect(screen.getByText("AWP | Asiimov (Field-Tested)")).toBeTruthy();
    expect(screen.queryByText("M4A4 | Howl (Field-Tested)")).toBeNull();
    expect(
      screen.getAllByRole("heading", { name: /AK-47 \| Redline/ }),
    ).toHaveLength(1);
    expect(screen.queryByText(/recomendado para você/i)).toBeNull();
    expect(screen.queryByText(/outros compradores/i)).toBeNull();
    expect(loadRecentlyViewedIds()).toEqual([
      "listing-1",
      "listing-seen",
      "listing-sold",
    ]);
    expect(getListing).toHaveBeenCalledWith("listing-seen");
    expect(getListing).toHaveBeenCalledWith("listing-sold");
  });

  it("omits the recently viewed block when only the current listing is stored", async () => {
    getListing.mockResolvedValue(makeListing());
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: /AK-47 \| Redline/ }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(loadRecentlyViewedIds()).toEqual(["listing-1"]);
    });
    expect(screen.queryByText(RECENTLY_VIEWED_HEADING)).toBeNull();
    expect(screen.queryByText(/nenhum visto/i)).toBeNull();
  });

  it("shows earlier ACTIVE views after navigating to another listing", async () => {
    const first = makeListing();
    const second = makeListing({
      id: "listing-2",
      productId: "awp-asiimov-ft",
      product: {
        ...makeListing().product,
        id: "awp-asiimov-ft",
        weapon: "AWP",
        skinName: "Asiimov",
      },
    });
    getListing.mockImplementation(async (id: unknown) => {
      if (id === "listing-1") return first;
      if (id === "listing-2") return second;
      throw new Error("gone");
    });
    listListings.mockResolvedValue({
      items: [first, second],
      total: 2,
      page: 1,
      limit: 4,
    });

    renderDetail();

    expect(
      await screen.findByRole("heading", { name: /AK-47 \| Redline/ }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(loadRecentlyViewedIds()).toEqual(["listing-1"]);
    });
    expect(screen.queryByText(RECENTLY_VIEWED_HEADING)).toBeNull();

    fireEvent.click(screen.getByText("AWP | Asiimov (Field-Tested)"));

    expect(
      await screen.findByRole("heading", { name: /AWP \| Asiimov/ }),
    ).toBeTruthy();
    expect(await screen.findByText(RECENTLY_VIEWED_HEADING)).toBeTruthy();
    const rail = screen
      .getByRole("heading", { name: RECENTLY_VIEWED_HEADING })
      .closest("section");
    expect(rail).toBeTruthy();
    expect(
      within(rail as HTMLElement).getByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    expect(
      within(rail as HTMLElement).queryByText("AWP | Asiimov (Field-Tested)"),
    ).toBeNull();
  });
});
