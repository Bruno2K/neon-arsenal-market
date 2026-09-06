import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListingCard, SkinThumb } from "../ProductCard";
import { CartProvider, useCart } from "../../contexts/CartContext";
import type { Listing } from "@/types/api";
import {
  CART_ADDED_MESSAGE,
  CART_CTA_ADD,
  CART_CTA_IN_CART,
  CART_CTA_SIMILAR,
  CART_CTA_VIEW_CART,
} from "@/lib/listingCartCta";
import { CART_STORAGE_KEY } from "@/lib/cartStorage";

const toast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

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
    name: CART_CTA_ADD,
  });
}

describe("ListingCard", () => {
  beforeEach(() => {
    toast.mockReset();
    localStorage.removeItem(CART_STORAGE_KEY);
  });
  it("renders weapon | skin (exterior) as the display name", () => {
    renderCard(makeListing());
    expect(
      screen.getByText("AK-47 | Redline (Field-Tested)"),
    ).toBeInTheDocument();
  });

  it("renders the catalog image when product.imageUrl is set", () => {
    renderCard(makeListing());
    expect(
      screen.getByRole("img", { name: "AK-47 | Redline (Field-Tested)" }),
    ).toHaveAttribute("src", "https://example.com/ak.png");
    expect(screen.queryByText("AK-", { exact: true })).not.toBeInTheDocument();
  });

  it("falls back to the weapon monogram when imageUrl is missing", () => {
    renderCard(
      makeListing({
        product: {
          ...makeListing().product,
          imageUrl: null,
        },
      }),
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("AK-", { exact: true })).toBeInTheDocument();
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
    expect(button).toHaveAttribute("aria-label", CART_CTA_ADD);
    expect(button).not.toHaveAttribute("title");
  });

  it("enables add-to-cart when trade lock has already expired", () => {
    renderCard(
      makeListing({
        status: "ACTIVE",
        tradeLockUntil: "2020-01-01T00:00:00.000Z",
      }),
    );
    expect(addButton()).toBeEnabled();
    expect(addButton()).toHaveAttribute("aria-label", CART_CTA_ADD);
  });

  it("shows Vendido and similar items instead of a disabled add button when SOLD", () => {
    renderCard(makeListing({ status: "SOLD" }));
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getByText("Vendido")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: CART_CTA_SIMILAR }),
    ).toHaveAttribute("href", "/products?productId=prod-1");
    fireEvent.click(screen.getByRole("link", { name: CART_CTA_SIMILAR }));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows Reservado instead of add-to-cart when status is RESERVED", () => {
    renderCard(makeListing({ status: "RESERVED" }));
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getByText("Reservado")).toBeInTheDocument();
  });

  it("shows Cancelado instead of add-to-cart when status is CANCELED", () => {
    renderCard(makeListing({ status: "CANCELED" }));
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("shows a visible trade lock reason when tradeLockUntil is in the future", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    renderCard(makeListing({ tradeLockUntil: future }));
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getByText(/Trade lock até/)).toBeInTheDocument();
  });

  it("does not add a SOLD listing from the similar-items path", () => {
    renderCard(makeListing({ status: "SOLD" }));
    fireEvent.click(screen.getByRole("link", { name: CART_CTA_SIMILAR }));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
  });

  it("adds the listing to the cart when the enabled button is clicked", () => {
    renderCard(makeListing({ status: "ACTIVE" }));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("0");
    fireEvent.click(addButton());
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    expect(toast).toHaveBeenCalledWith({ title: CART_ADDED_MESSAGE });
    expect(screen.getByText(CART_ADDED_MESSAGE)).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("explains a second add of the same listing as already in the cart", () => {
    renderCard(makeListing({ status: "ACTIVE" }));
    fireEvent.click(addButton());
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    expect(screen.queryByRole("button", { name: CART_CTA_ADD })).toBeNull();
    expect(screen.getByText(CART_CTA_IN_CART)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: CART_CTA_VIEW_CART }),
    ).toHaveAttribute("href", "/cart");
    fireEvent.click(screen.getByRole("link", { name: CART_CTA_VIEW_CART }));
    expect(screen.getByTestId("cart-count")).toHaveTextContent("1");
    expect(toast).toHaveBeenCalledTimes(1);
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
    const listingLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/listing/listing-abc");
    expect(listingLinks).toHaveLength(2);
  });

  it("does not leak SKINMARKET or CS2 Skin Marketplace copy", () => {
    renderCard(makeListing());
    expect(screen.queryByText(/SKINMARKET/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/CS2 Skin Marketplace/i)).not.toBeInTheDocument();
  });
});

describe("SkinThumb", () => {
  it("renders a compact catalog image", () => {
    render(
      <SkinThumb
        product={{
          weapon: "AK-47",
          skinName: "Redline",
          exterior: "Field-Tested",
          imageUrl: "https://cs2.sh/image/ak.png",
        }}
      />,
    );
    expect(
      screen.getByRole("img", { name: "AK-47 | Redline (Field-Tested)" }),
    ).toHaveAttribute("src", "https://cs2.sh/image/ak.png");
  });

  it("hides the image from the accessibility tree when decorative", () => {
    render(
      <SkinThumb
        decorative
        product={{
          weapon: "AK-47",
          skinName: "Redline",
          exterior: "Field-Tested",
          imageUrl: "https://cs2.sh/image/ak.png",
        }}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(
      document.querySelector('img[src="https://cs2.sh/image/ak.png"]'),
    ).toBeTruthy();
  });
});
