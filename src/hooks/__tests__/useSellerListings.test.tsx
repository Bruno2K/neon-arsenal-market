import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing, Product, Seller } from "@/types/api";
import {
  setAnalyticsCollector,
  type AnalyticsEventName,
  type AnalyticsProps,
} from "@/lib/analytics";
import { useSellerListings } from "../useSellerListings";

const getSellerMe = vi.fn();
const getSellerListings = vi.fn();
const createListing = vi.fn();
const updateListing = vi.fn();
const updateListingPrice = vi.fn();
const cancelListing = vi.fn();
const toast = vi.fn();

vi.mock("@/api", () => ({
  getSellerMe: (...args: unknown[]) => getSellerMe(...args),
  getSellerListings: (...args: unknown[]) => getSellerListings(...args),
  createListing: (...args: unknown[]) => createListing(...args),
  updateListing: (...args: unknown[]) => updateListing(...args),
  updateListingPrice: (...args: unknown[]) => updateListingPrice(...args),
  cancelListing: (...args: unknown[]) => cancelListing(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

function seller(overrides: Partial<Seller> = {}): Seller {
  return {
    id: "seller-1",
    userId: "user-1",
    storeName: "NeonTrader Store",
    balance: 0,
    rating: 0,
    isApproved: true,
    ...overrides,
  };
}

function product(): Product {
  return {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    isStattrak: false,
    isSouvenir: false,
    imageUrl: "https://cs2.sh/image/ak-redline.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function listing(overrides: Partial<Listing> = {}): Listing {
  const catalog = product();
  return {
    id: "listing-1",
    productId: catalog.id,
    sellerId: "seller-1",
    floatValue: 0.25,
    pattern: 123,
    price: 18.5,
    currency: "USD",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: catalog,
    seller: { id: "seller-1", storeName: "NeonTrader Store" },
    ...overrides,
  };
}

const analyticsEvents: { event: AnalyticsEventName; props: AnalyticsProps }[] =
  [];

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useSellerListings", () => {
  beforeEach(() => {
    analyticsEvents.length = 0;
    setAnalyticsCollector((event, props) => {
      analyticsEvents.push({ event, props });
    });
    toast.mockReset();
    getSellerMe.mockReset();
    getSellerListings.mockReset();
    createListing.mockReset();
    updateListing.mockReset();
    updateListingPrice.mockReset();
    cancelListing.mockReset();
    getSellerMe.mockResolvedValue(seller());
    getSellerListings.mockResolvedValue({ items: [listing()], total: 1 });
  });

  afterEach(() => {
    setAnalyticsCollector(null);
  });

  it("loads seller and listings through React Query", async () => {
    const { result } = renderHook(() => useSellerListings(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.listings).toHaveLength(1);
    });

    expect(getSellerMe).toHaveBeenCalled();
    expect(getSellerListings).toHaveBeenCalled();
    expect(result.current.canCreateListing).toBe(true);
    expect(result.current.pendingApproval).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => useSellerListings({ enabled: false }), {
      wrapper: wrapper(),
    });

    expect(result.current.loading).toBe(false);
    expect(getSellerMe).not.toHaveBeenCalled();
    expect(getSellerListings).not.toHaveBeenCalled();
  });

  it("blocks create when the seller is pending approval", async () => {
    getSellerMe.mockResolvedValue(seller({ isApproved: false }));

    const { result } = renderHook(() => useSellerListings(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.seller?.isApproved).toBe(false);
    });

    expect(result.current.canCreateListing).toBe(false);
    expect(result.current.pendingApproval).toBe(true);
  });

  it("surfaces a load error for retry", async () => {
    getSellerMe.mockRejectedValue(new Error("sessão expirada"));

    const { result } = renderHook(() => useSellerListings(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
    expect(getSellerListings).not.toHaveBeenCalled();
  });

  it("creates a listing, tracks analytics, and invalidates the list", async () => {
    const created = listing({ id: "listing-new", price: 18.5 });
    createListing.mockResolvedValue(created);

    const { result } = renderHook(() => useSellerListings(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.create.mutateAsync({
      productId: created.productId,
      floatValue: 0.25,
      price: 18.5,
    });

    await waitFor(() => {
      expect(createListing).toHaveBeenCalled();
      expect(analyticsEvents).toContainEqual({
        event: "seller_listing_created",
        props: {
          listingId: "listing-new",
          productId: "ak-redline-ft",
          price: "18.5",
          source: "seller",
        },
      });
      expect(toast).toHaveBeenCalledWith({ title: "Listing criado" });
      expect(getSellerListings.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("updates price and cancels through isolated mutations", async () => {
    updateListingPrice.mockResolvedValue(listing({ price: 22 }));
    cancelListing.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSellerListings(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.updatePrice.mutateAsync({
      id: "listing-1",
      newPrice: 22,
    });
    await result.current.cancel.mutateAsync(listing());

    expect(updateListingPrice).toHaveBeenCalledWith("listing-1", {
      newPrice: 22,
    });
    expect(cancelListing).toHaveBeenCalledWith("listing-1");
    expect(toast).toHaveBeenCalledWith({ title: "Preço atualizado" });
    expect(toast).toHaveBeenCalledWith({ title: "Listing cancelado" });
  });
});
