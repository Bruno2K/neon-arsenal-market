import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function listing(price = 100, id = "listing-ak"): Listing {
  return {
    id,
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

function CheckoutHarness({ nonce = 0 }: { nonce?: number }) {
  void nonce;
  return (
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>
  );
}

function renderCheckout(nonce = 0) {
  return render(<CheckoutHarness nonce={nonce} />);
}

function asCustomer() {
  authState.isAuthenticated = true;
  authState.user = {
    id: "u1",
    name: "Buyer",
    email: "buyer@test.com",
    role: "CUSTOMER",
  } as User;
}

function idempotencyKeyOf(call: unknown[]): string {
  const options = call[1] as { idempotencyKey: string };
  return options.idempotencyKey;
}

describe("Checkout", () => {
  const uuidKeys = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];

  beforeEach(() => {
    cartState.items = [];
    cartState.totalPrice = 0;
    cartState.clearCart.mockReset();
    authState.user = null;
    authState.isAuthenticated = false;
    createOrder.mockReset();
    createPaymentLink.mockReset();
    let uuidIndex = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => uuidKeys[uuidIndex++] ?? "overflow-uuid",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    asCustomer();

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
    asCustomer();
    createOrder.mockResolvedValue({ id: "order-1" });
    createPaymentLink.mockResolvedValue({});

    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledWith(
        { items: [{ listingId: "listing-ak" }] },
        { idempotencyKey: uuidKeys[0] },
      );
      expect(createPaymentLink).toHaveBeenCalledWith({ orderId: "order-1" });
    });

    expect(
      screen.getByText(/pagamento ainda não foi confirmado/i),
    ).toBeTruthy();
    expect(cartState.clearCart).not.toHaveBeenCalled();
    expect(screen.queryByText(/Pedido Confirmado/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeTruthy();
  });

  it("sends a non-empty Idempotency-Key of at most 128 characters", async () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    asCustomer();
    createOrder.mockRejectedValue(new Error("Falha de rede"));

    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));

    const key = idempotencyKeyOf(createOrder.mock.calls[0]);
    expect(key).toBe(uuidKeys[0]);
    expect(key.length).toBeGreaterThan(0);
    expect(key.length).toBeLessThanOrEqual(128);
  });

  it("reuses the same Idempotency-Key when retrying with the same listings", async () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    asCustomer();
    createOrder.mockRejectedValue(new Error("Falha de rede"));

    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    await waitFor(() => {
      expect(screen.getByText("Falha de rede")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Tentar novamente" }),
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));

    expect(idempotencyKeyOf(createOrder.mock.calls[0])).toBe(uuidKeys[0]);
    expect(idempotencyKeyOf(createOrder.mock.calls[1])).toBe(uuidKeys[0]);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("issues a new Idempotency-Key when the listing set changes", async () => {
    cartState.items = [{ listing: listing(100, "listing-ak") }];
    cartState.totalPrice = 100;
    asCustomer();
    createOrder.mockRejectedValue(new Error("Falha de rede"));

    const view = renderCheckout(0);
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));

    cartState.items = [
      { listing: listing(80, "listing-ak") },
      { listing: listing(20, "listing-awp") },
    ];
    cartState.totalPrice = 100;
    view.rerender(<CheckoutHarness nonce={1} />);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));

    expect(idempotencyKeyOf(createOrder.mock.calls[0])).toBe(uuidKeys[0]);
    expect(idempotencyKeyOf(createOrder.mock.calls[1])).toBe(uuidKeys[1]);
    expect(createOrder.mock.calls[1][0]).toEqual({
      items: [{ listingId: "listing-ak" }, { listingId: "listing-awp" }],
    });
  });

  it("does not fire two POSTs with different keys on double-click", async () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    asCustomer();

    let release: (value: { id: string }) => void = () => {};
    createOrder.mockImplementation(
      () =>
        new Promise<{ id: string }>((resolve) => {
          release = resolve;
        }),
    );
    createPaymentLink.mockResolvedValue({});

    renderCheckout();
    const button = screen.getByRole("button", { name: /Pagar com PayPal/ });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: "Abrindo o PayPal..." }),
    ).toBeDisabled();

    release({ id: "order-1" });
    await waitFor(() => expect(createPaymentLink).toHaveBeenCalledTimes(1));

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(idempotencyKeyOf(createOrder.mock.calls[0])).toBe(uuidKeys[0]);
  });
});
