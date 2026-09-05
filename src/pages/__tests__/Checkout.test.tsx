import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Checkout from "../Checkout";
import type { Listing, User } from "@/types/api";

const createOrder = vi.fn();
const createPaymentLink = vi.fn();

const cartState = {
  items: [] as { listing: Listing }[],
  totalPrice: 0,
  clearCart: vi.fn(),
};

const authState = {
  user: null as User | null,
  isAuthenticated: false,
};

vi.mock("@/api/orders", () => ({
  createOrder: (...args: unknown[]) => createOrder(...args),
}));

vi.mock("@/api/payments", () => ({
  createPaymentLink: (...args: unknown[]) => createPaymentLink(...args),
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => cartState,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function listing(price = 100): Listing {
  return {
    id: "listing-ak",
    productId: "prod-1",
    sellerId: "seller-1",
    floatValue: 0.15 as unknown as Listing["floatValue"],
    price: price as unknown as Listing["price"],
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
    seller: { id: "seller-1", storeName: "Store Alpha" },
  } as Listing;
}

function renderCheckout() {
  return render(
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>,
  );
}

describe("Checkout", () => {
  beforeEach(() => {
    cartState.items = [];
    cartState.totalPrice = 0;
    cartState.clearCart.mockReset();
    authState.user = null;
    authState.isAuthenticated = false;
    createOrder.mockReset();
    createPaymentLink.mockReset();
  });

  it("keeps empty-cart gate and does not offer PayPal", () => {
    renderCheckout();
    expect(screen.getByText("Carrinho vazio")).toBeTruthy();
    expect(screen.getByText("Ir ao Market")).toBeTruthy();
    expect(screen.queryByText(/Pagar com PayPal/)).toBeNull();
  });

  it("keeps CUSTOMER-only pay gate when the cart has items", () => {
    cartState.items = [{ listing: listing() }];
    cartState.totalPrice = 100;
    renderCheckout();
    expect(screen.getByText("Login de comprador necessário")).toBeTruthy();
    expect(screen.getByText("Ir para Login")).toBeTruthy();
    expect(screen.queryByText(/Pagar com PayPal/)).toBeNull();
  });

  it("shows 5% fee and does not claim payment succeeded", () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    authState.isAuthenticated = true;
    authState.user = {
      id: "u1",
      name: "Buyer",
      email: "buyer@test.com",
      role: "CUSTOMER",
    } as User;

    renderCheckout();

    expect(screen.getAllByText("$100.00").length).toBe(2);
    expect(screen.getByText("$5.00")).toBeTruthy();
    expect(screen.getByText("$105.00")).toBeTruthy();
    expect(screen.getByText(/Pagar com PayPal — \$105\.00/)).toBeTruthy();
    expect(screen.queryByText(/Pedido Confirmado/i)).toBeNull();
    expect(screen.queryByText(/processado com sucesso/i)).toBeNull();
    expect(
      screen.getByText(/só é confirmado depois que o provedor retornar/i),
    ).toBeTruthy();
  });

  it("calls createOrder + createPaymentLink and errors without claiming success", async () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    authState.isAuthenticated = true;
    authState.user = {
      id: "u1",
      name: "Buyer",
      email: "buyer@test.com",
      role: "CUSTOMER",
    } as User;
    createOrder.mockResolvedValue({ id: "order-1" });
    createPaymentLink.mockResolvedValue({});

    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledWith({
        items: [{ listingId: "listing-ak" }],
      });
      expect(createPaymentLink).toHaveBeenCalledWith({ orderId: "order-1" });
    });

    expect(
      screen.getByText(/pagamento ainda não foi confirmado/i),
    ).toBeTruthy();
    expect(cartState.clearCart).not.toHaveBeenCalled();
    expect(screen.queryByText(/Pedido Confirmado/i)).toBeNull();
  });
});
