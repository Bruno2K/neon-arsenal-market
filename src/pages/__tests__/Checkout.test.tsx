import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Checkout from "../Checkout";
import type { Listing, Order, User } from "@/types/api";
import { PRE_ORDER_HOLD_COPY } from "@/lib/orderPaymentView";

const createOrder = vi.fn();
const createPaymentLink = vi.fn();
const redirectToExternal = vi.fn();
const reserveListing = vi.fn();

const cartState = {
  items: [] as { listing: Listing }[],
  totalPrice: 0,
  clearCart: vi.fn(),
  removeItems: vi.fn(),
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

vi.mock("@/lib/redirect", () => ({
  redirectToExternal: (...args: unknown[]) => redirectToExternal(...args),
}));

vi.mock("@/api/listings", () => ({
  reserveListing: (...args: unknown[]) => reserveListing(...args),
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

function pendingCreatedOrder(expiresAt: string, id = "order-1"): Order {
  return {
    id,
    totalAmount: 105,
    status: "PENDING",
    paymentStatus: "PENDING",
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
    items: [
      {
        id: "item-1",
        listingId: "listing-ak",
        sellerId: "seller-1",
        priceSnapshot: 100,
        listing: {
          id: "listing-ak",
          reservedAt: "2026-09-05T12:00:00.000Z",
          reservationExpiresAt: expiresAt,
          reservedByOrderId: id,
          product: {
            id: "prod-1",
            weapon: "AK-47",
            skinName: "Redline",
            exterior: "Field-Tested",
          },
        },
      },
    ],
  };
}

function expectedPaypalUrls(orderId: string) {
  return {
    returnUrl: `${window.location.origin}/orders/${orderId}/return`,
    cancelUrl: `${window.location.origin}/orders/${orderId}/cancel`,
  };
}

function CheckoutHarness({ nonce = 0 }: { nonce?: number }) {
  void nonce;
  return (
    <MemoryRouter initialEntries={["/checkout"]}>
      <Routes>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders/:id" element={<div>Pedido destino</div>} />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
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
    cartState.removeItems.mockReset();
    authState.user = null;
    authState.isAuthenticated = false;
    createOrder.mockReset();
    createPaymentLink.mockReset();
    redirectToExternal.mockReset();
    reserveListing.mockReset();
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
    expect(screen.getByText(PRE_ORDER_HOLD_COPY)).toBeTruthy();
    expect(screen.queryByText(/Reservado para você/)).toBeNull();
    expect(screen.queryByText(/Pedido Confirmado/i)).toBeNull();
    expect(screen.queryByText(/processado com sucesso/i)).toBeNull();
    expect(
      screen.getByText(/só é confirmado depois que o provedor retornar/i),
    ).toBeTruthy();
  });

  it("sends absolute returnUrl and cancelUrl and prunes ordered listings", async () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    asCustomer();
    createOrder.mockResolvedValue({ id: "order-1" });
    createPaymentLink.mockResolvedValue({
      approvalUrl: "https://www.paypal.com/checkoutnow?token=EC-1",
    });

    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledWith(
        { items: [{ listingId: "listing-ak" }] },
        { idempotencyKey: uuidKeys[0] },
      );
      expect(createPaymentLink).toHaveBeenCalledWith({
        orderId: "order-1",
        ...expectedPaypalUrls("order-1"),
      });
    });

    const urls = createPaymentLink.mock.calls[0][0] as {
      returnUrl: string;
      cancelUrl: string;
    };
    expect(() => new URL(urls.returnUrl)).not.toThrow();
    expect(() => new URL(urls.cancelUrl)).not.toThrow();
    expect(urls.returnUrl.startsWith("http")).toBe(true);
    expect(urls.cancelUrl.startsWith("http")).toBe(true);
    expect(cartState.removeItems).toHaveBeenCalledWith(["listing-ak"]);
    expect(cartState.clearCart).not.toHaveBeenCalled();
    expect(redirectToExternal).toHaveBeenCalledWith(
      "https://www.paypal.com/checkoutnow?token=EC-1",
    );
    expect(screen.queryByText(/Pedido Confirmado/i)).toBeNull();
    expect(screen.queryByText(/Pagamento confirmado/i)).toBeNull();
  });

  it("removes only listings that entered the order, keeping others", async () => {
    cartState.items = [
      { listing: listing(80, "listing-ak") },
      { listing: listing(20, "listing-awp") },
    ];
    cartState.totalPrice = 100;
    asCustomer();
    createOrder.mockResolvedValue({ id: "order-2" });
    createPaymentLink.mockResolvedValue({});

    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    await waitFor(() => {
      expect(cartState.removeItems).toHaveBeenCalledWith([
        "listing-ak",
        "listing-awp",
      ]);
    });
    expect(cartState.clearCart).not.toHaveBeenCalled();
    expect(await screen.findByText("Pedido destino")).toBeTruthy();
  });

  it("does not prune the cart when createOrder fails", async () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    asCustomer();
    createOrder.mockRejectedValue(new Error("Falha de rede"));

    renderCheckout();
    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(cartState.removeItems).not.toHaveBeenCalled();
    expect(cartState.clearCart).not.toHaveBeenCalled();
    expect(createPaymentLink).not.toHaveBeenCalled();
    expect(screen.getByText("Falha de rede")).toBeTruthy();
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
    expect(createPaymentLink.mock.calls[0][0]).toMatchObject({
      orderId: "order-1",
      ...expectedPaypalUrls("order-1"),
    });
  });

  it("does not reserve on checkout start and shows a server countdown after createOrder", async () => {
    cartState.items = [{ listing: listing(100) }];
    cartState.totalPrice = 100;
    asCustomer();
    const now = Date.parse("2026-09-05T12:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    createOrder.mockResolvedValue(
      pendingCreatedOrder("2026-09-05T12:01:32.000Z"),
    );
    let releasePayment: (value: { approvalUrl: string }) => void = () => {};
    createPaymentLink.mockImplementation(
      () =>
        new Promise<{ approvalUrl: string }>((resolve) => {
          releasePayment = resolve;
        }),
    );

    renderCheckout();
    expect(screen.getByText(PRE_ORDER_HOLD_COPY)).toBeTruthy();
    expect(screen.queryByText(/Reservado para você/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Pagar com PayPal/ }));

    expect(await screen.findAllByText(/Reservado para você/)).toHaveLength(2);
    expect(screen.getByText("01:32")).toBeTruthy();
    expect(screen.queryByText("15:00")).toBeNull();
    expect(reserveListing).not.toHaveBeenCalled();
    expect(createPaymentLink).toHaveBeenCalledTimes(1);

    releasePayment({
      approvalUrl: "https://www.paypal.com/checkoutnow?token=EC-1",
    });
    await waitFor(() => {
      expect(redirectToExternal).toHaveBeenCalledWith(
        "https://www.paypal.com/checkoutnow?token=EC-1",
      );
    });
  });
});
