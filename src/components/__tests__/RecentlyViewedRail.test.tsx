import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecentlyViewedRail } from "../RecentlyViewedRail";
import { CartProvider } from "@/contexts/CartContext";
import type { Listing } from "@/types/api";
import {
  RECENTLY_VIEWED_COPY,
  RECENTLY_VIEWED_HEADING,
} from "@/lib/recentlyViewed";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-2",
    productId: "awp-asiimov-ft",
    sellerId: "seller-1",
    price: 18.5,
    currency: "BRL",
    status: "ACTIVE",
    floatValue: 0.21,
    pattern: 12,
    tradeLockUntil: null,
    steamAssetId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    product: {
      id: "awp-asiimov-ft",
      game: "CS2",
      weapon: "AWP",
      skinName: "Asiimov",
      rarity: "Covert",
      collection: "The Operation Phoenix Collection",
      exterior: "Field-Tested",
      isStattrak: false,
      isSouvenir: false,
      imageUrl: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    seller: {
      id: "seller-1",
      storeName: "Neon Store",
      user: { id: "user-1", name: "Alice" },
    },
    ...overrides,
  };
}

describe("RecentlyViewedRail", () => {
  it("renders nothing when there are no fetchable listings", () => {
    const { container } = render(<RecentlyViewedRail listings={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(RECENTLY_VIEWED_HEADING)).toBeNull();
    expect(screen.queryByText(/nenhum visto/i)).toBeNull();
  });

  it("uses history copy instead of a personalization engine", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <CartProvider>
            <RecentlyViewedRail listings={[makeListing()]} />
          </CartProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(RECENTLY_VIEWED_HEADING)).toBeTruthy();
    expect(screen.getByText(RECENTLY_VIEWED_COPY)).toBeTruthy();
    expect(screen.getByText("AWP | Asiimov (Field-Tested)")).toBeTruthy();
    expect(screen.queryByText(/recomendado para você/i)).toBeNull();
    expect(screen.queryByText(/outros compradores/i)).toBeNull();
    expect(screen.queryByText(/personaliz/i)).toBeNull();
  });
});
