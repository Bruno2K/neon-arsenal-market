import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListingCard } from "../ProductCard";
import { CartProvider, useCart } from "@/contexts/CartContext";
import type { Listing } from "@/types/api";

// Mock framer-motion to avoid animation issues
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function makeListing(overrides: Partial<Record<string, unknown>> = {}): Listing {
  return {
    id: "listing-1",
    productId: "prod-1",
    sellerId: "seller-1",
    floatValue: 0.14501234,
    price: 149.99,
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
      skinName: "Redline",
      rarity: "Classified",
      exterior: "Field-Tested",
      imageUrl: null,
      isStattrak: false,
      isSouvenir: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    seller: {
      id: "seller-1",
      storeName: "Store Alpha",
      user: { name: "Bruno", id: "user-1" },
    },
    ...overrides,
  } as unknown as Listing;
}

function renderCard(listing: Listing) {
  return render(
    <MemoryRouter>
      <CartProvider>
        <ListingCard listing={listing} />
      </CartProvider>
    </MemoryRouter>
  );
}

describe("ListingCard", () => {
  describe("product name display", () => {
    it("renders weapon | skinName (exterior) format", () => {
      renderCard(makeListing());
      const elements = screen.getAllByText(/AK-47 \| Redline \(Field-Tested\)/);
      expect(elements.length).toBeGreaterThan(0);
    });

    it("shows StatTrak™ badge for StatTrak items", () => {
      renderCard(makeListing({ product: { ...makeListing().product, isStattrak: true } }));
      expect(screen.getByText("StatTrak™")).toBeTruthy();
    });

    it("does not show StatTrak badge for non-StatTrak items", () => {
      renderCard(makeListing());
      expect(screen.queryByText("StatTrak™")).toBeNull();
    });
  });

  describe("price display", () => {
    it("renders formatted price", () => {
      renderCard(makeListing({ price: 299.5 }));
      expect(screen.getByText("$299.50")).toBeTruthy();
    });

    it("handles integer price", () => {
      renderCard(makeListing({ price: 100 }));
      expect(screen.getByText("$100.00")).toBeTruthy();
    });
  });

  describe("float value display", () => {
    it("renders float value with 8 decimal places", () => {
      renderCard(makeListing({ floatValue: 0.14501234 }));
      expect(screen.getByText(/Float: 0\.14501234/)).toBeTruthy();
    });
  });

  describe("seller info", () => {
    it("renders seller name", () => {
      renderCard(makeListing());
      expect(screen.getByText("Bruno")).toBeTruthy();
    });

    it("falls back to storeName when user name not available", () => {
      renderCard(makeListing({ seller: { id: "seller-1", storeName: "CS Skins Shop" } }));
      expect(screen.getByText("CS Skins Shop")).toBeTruthy();
    });
  });

  describe("add to cart button", () => {
    it("is enabled for ACTIVE listings without trade lock", () => {
      renderCard(makeListing());
      const btn = screen.getByTitle("Adicionar ao carrinho");
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    it("is disabled for non-ACTIVE listings", () => {
      renderCard(makeListing({ status: "SOLD" }));
      const btn = screen.getByTitle("Item não disponível");
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("is disabled for trade-locked listings", () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      renderCard(makeListing({ tradeLockUntil: futureDate }));
      const btn = screen.getByTitle("Item não disponível");
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it("adds listing to cart when clicked", () => {
      const CartObserver = () => {
        const { totalItems } = useCart();
        return <span data-testid="cart-count">{totalItems}</span>;
      };

      render(
        <MemoryRouter>
          <CartProvider>
            <ListingCard listing={makeListing()} />
            <CartObserver />
          </CartProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId("cart-count").textContent).toBe("0");
      fireEvent.click(screen.getByTitle("Adicionar ao carrinho"));
      expect(screen.getByTestId("cart-count").textContent).toBe("1");
    });
  });

  describe("pattern display", () => {
    it("shows pattern when present", () => {
      renderCard(makeListing({ pattern: 661 }));
      expect(screen.getByText("Pattern: 661")).toBeTruthy();
    });

    it("does not show pattern when null/undefined", () => {
      renderCard(makeListing({ pattern: null }));
      expect(screen.queryByText(/Pattern:/)).toBeNull();
    });
  });

  describe("navigation", () => {
    it("links to /listing/:id", () => {
      renderCard(makeListing({ id: "abc-123" }));
      const links = screen.getAllByRole("link");
      expect(links[0].getAttribute("href")).toBe("/listing/abc-123");
    });
  });
});
