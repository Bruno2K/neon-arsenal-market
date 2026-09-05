import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListingCard } from "../ProductCard";
import { CartProvider, useCart } from "../../contexts/CartContext";
import type { Listing } from "@/types/api";

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    productId: "prod-1",
    sellerId: "seller-1",
    price: 299.5,
    currency: "USD",
    status: "ACTIVE",
    floatValue: 0.12345678,
    pattern: 412,
    tradeLockUntil: null,
    steamAssetId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    product: {
      id: "prod-1",
      game: "CS2",
      weapon: "AK-47",
      skinName: "Redline",
      rarity: "Classified",
      collection: "The Phoenix Collection",
      exterior: "Field-Tested",
      isStattrak: false,
      isSouvenir: false,
      imageUrl: "https://example.com/ak.png",
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

function CartProbe() {
  const { totalItems } = useCart();
  return <span data-testid="cart-count">{totalItems}</span>;
}

function renderCard(listing: Listing) {
  return render(
    <MemoryRouter>
      <CartProvider>
        <ListingCard listing={listing} />
        <CartProbe />
      </CartProvider>
    </MemoryRouter>,
  );
}

function addButton() {
  return screen.getByRole("button", {
    name: /adicionar ao carrinho|item não disponível/i,
  });
}

describe("ListingCard", () => {
  it("renders weapon | skin (exterior) as the display name", () => {
    renderCard(makeListing());
    expect(
      screen.getByText("AK-47 | Redline (Field-Tested)"),
    ).toBeInTheDocument();
  });

  it("shows StatTrak badge only when product.isStattrak is true", () => {
    const { rerender } = renderCard(makeListing());
    expect(screen.queryByText("StatTrak™")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <CartProvider>
          <ListingCard
            listing={makeListing({
              product: {
                ...makeListing().product,
                isStattrak: true,
              },
            })}
          />
          <CartProbe />
        </CartProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("StatTrak™")).toBeInTheDocument();
  });

  it("formats the listing price with two decimals and a $ prefix", () => {
    renderCard(makeListing({ price: 299.5 }));
    expect(screen.getByText("$299.50")).toBeInTheDocument();
  });

  it("formats whole-dollar prices with two decimals", () => {
    renderCard(makeListing({ price: 100 }));
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("formats string prices through Number() with two decimals", () => {
    renderCard(makeListing({ price: "49.9" as unknown as number }));
    expect(screen.getByText("$49.90")).toBeInTheDocument();
  });

  it("shows float with 8 decimal places", () => {
    renderCard(makeListing({ floatValue: 0.12345678 }));
    expect(screen.getByText(/0\.12345678/)).toBeInTheDocument();
  });

  it("shows seller.user.name when present", () => {
    renderCard(makeListing());
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("falls back to seller.storeName when user name is missing", () => {
    renderCard(
      makeListing({
        seller: {
          id: "seller-1",
          storeName: "Backup Store",
        },
      }),
    );
    expect(screen.getByText("Backup Store")).toBeInTheDocument();
  });

  it("enables add-to-cart when status is ACTIVE and there is no trade lock", () => {
    renderCard(makeListing({ status: "ACTIVE", tradeLockUntil: null }));
    const button = addButton();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "Adicionar ao carrinho");
    expect(button).toHaveAttribute("aria-label", "Adicionar ao carrinho");
  });

  it("enables add-to-cart when trade lock has already expired", () => {
    renderCard(
      makeListing({
        status: "ACTIVE",
        tradeLockUntil: "2020-01-01T00:00:00.000Z",
      }),
    );
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveAttribute("title", "Adicionar ao carrinho");
  });

  it("disables add-to-cart when status is SOLD", () => {
    renderCard(makeListing({ status: "SOLD" }));
    const button = addButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Item não disponível");
    expect(button).toHaveAttribute("aria-label", "Item não disponível");
  });

  it("disables add-to-cart when status is RESERVED", () => {
    renderCard(makeListing({ status: "RESERVED" }));
    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveAttribute("title", "Item não disponível");
  });

  it("disables add-to-cart when status is CANCELED", () => {
    renderCard(makeListing({ status: "CANCELED" }));
    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveAttribute("title", "Item não disponível");
  });

  it("disables add-to-cart when tradeLockUntil is in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    renderCard(makeListing({ tradeLockUntil: future }));
    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveAttribute("title", "Item não disponível");
  });

  it("does not add a SOLD listing when the disabled button is activated", () => {
    renderCard(makeListing({ status: "SOLD" }));
    fireEvent.click(addButton());
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
  });

  it("adds the listing to the cart when the enabled button is clicked", () => {
    renderCard(makeListing({ status: "ACTIVE" }));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
    fireEvent.click(addButton());
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
  });

  it("shows pattern when present and hides it when null", () => {
    const { rerender } = renderCard(makeListing({ pattern: 412 }));
    expect(screen.getByText("Pattern: 412")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <CartProvider>
          <ListingCard listing={makeListing({ pattern: null })} />
          <CartProbe />
        </CartProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Pattern:/)).not.toBeInTheDocument();
  });

  it("links both the image and the title to /listing/:id", () => {
    renderCard(makeListing({ id: "listing-abc" }));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/listing/listing-abc");
    }
  });

  it("does not leak SKINMARKET or CS2 Skin Marketplace copy", () => {
    renderCard(makeListing());
    expect(screen.queryByText(/SKINMARKET/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CS2 Skin Marketplace/i)).not.toBeInTheDocument();
  });
});
