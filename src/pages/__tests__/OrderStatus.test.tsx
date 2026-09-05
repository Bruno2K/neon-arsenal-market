import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OrderStatusPage from "../OrderStatus";
import type { Order } from "@/types/api";

const getOrder = vi.fn();
const createPaymentLink = vi.fn();
const createOrder = vi.fn();

vi.mock("@/api/orders", () => ({
  getOrder: (...args: unknown[]) => getOrder(...args),
  createOrder: (...args: unknown[]) => createOrder(...args),
}));

vi.mock("@/api/payments", () => ({
  createPaymentLink: (...args: unknown[]) => createPaymentLink(...args),
}));

function pendingOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    totalAmount: 105,
    status: "PENDING",
    paymentStatus: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "item-1",
        listingId: "listing-ak",
        sellerId: "seller-1",
        priceSnapshot: 105,
        listing: {
          id: "listing-ak",
          reservationExpiresAt: new Date(
            Date.now() + 5 * 60 * 1000,
          ).toISOString(),
          product: {
            id: "prod-1",
            weapon: "AK-47",
            skinName: "Redline",
            exterior: "Field-Tested",
          },
        },
      },
    ],
    ...overrides,
  };
}

function renderPage(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderStatusPage />} />
          <Route path="/orders/:id/return" element={<OrderStatusPage />} />
          <Route path="/orders/:id/cancel" element={<OrderStatusPage />} />
          <Route path="/products" element={<div>Market</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrderStatusPage", () => {
  beforeEach(() => {
    getOrder.mockReset();
    createPaymentLink.mockReset();
    createOrder.mockReset();
    vi.spyOn(window.location, "assign").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a skeleton while the order loads", () => {
    getOrder.mockImplementation(() => new Promise(() => {}));
    renderPage("/orders/order-1/return");
    expect(
      screen.getByRole("status", { name: "Carregando pedido" }),
    ).toBeTruthy();
  });

  it("does not claim payment is confirmed while paymentStatus is PENDING", async () => {
    getOrder.mockResolvedValue(pendingOrder());
    renderPage("/orders/order-1/return");

    expect(
      await screen.findByRole("heading", {
        name: "Pedido criado. Aguardando confirmação do PayPal.",
      }),
    ).toBeTruthy();
    expect(screen.getByText("AK-47 | Redline (Field-Tested)")).toBeTruthy();
    expect(screen.getByText("$105.00")).toBeTruthy();
    expect(screen.getByText("Pedido PENDING")).toBeTruthy();
    expect(screen.getByText("Pagamento PENDING")).toBeTruthy();
    expect(screen.queryByText("Pagamento confirmado.")).toBeNull();
    expect(screen.getByText(/confirmação real vem do PayPal/i)).toBeTruthy();
  });

  it("says payment is confirmed only when paymentStatus is PAID", async () => {
    getOrder.mockResolvedValue(
      pendingOrder({ paymentStatus: "PAID", status: "CONFIRMED" }),
    );
    renderPage("/orders/order-1/return");

    expect(
      await screen.findByRole("heading", { name: "Pagamento confirmado." }),
    ).toBeTruthy();
    expect(screen.getByText("Pagamento PAID")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Pagar novamente" }),
    ).toBeNull();
  });

  it("shows the cancel screen without claiming a local payment", async () => {
    getOrder.mockResolvedValue(pendingOrder());
    renderPage("/orders/order-1/cancel");

    expect(
      await screen.findByRole("heading", {
        name: "Você cancelou o pagamento.",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/reserva expira em \d{2}:\d{2}/)).toBeTruthy();
    expect(screen.getByText("Pedido PENDING")).toBeTruthy();
    expect(screen.queryByText("Pagamento confirmado.")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Pagar novamente" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir ao Market" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("maps 403/404 to pedido não encontrado", async () => {
    getOrder.mockRejectedValue(new Error("Not your order"));
    renderPage("/orders/order-missing");

    expect(await screen.findByText("Pedido não encontrado")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir ao Market" })).toBeTruthy();
    expect(screen.queryByText("Pagamento confirmado.")).toBeNull();
  });

  it("offers a network retry that does not invent a paid state", async () => {
    getOrder.mockRejectedValue(new Error("Falha de rede"));
    renderPage("/orders/order-1/return");

    expect(await screen.findByText("Erro ao carregar o pedido")).toBeTruthy();
    expect(screen.getByText("Falha de rede")).toBeTruthy();
    getOrder.mockResolvedValue(pendingOrder());
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByText(
        "Pedido criado. Aguardando confirmação do PayPal.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Pagamento confirmado.")).toBeNull();
  });

  it("retries payment on the existing order and does not create another", async () => {
    getOrder.mockResolvedValue(pendingOrder());
    createPaymentLink.mockResolvedValue({
      approvalUrl: "https://www.paypal.com/checkoutnow?token=EC-retry",
    });
    renderPage("/orders/order-1/cancel");

    const retry = await screen.findByRole("button", {
      name: "Pagar novamente",
    });
    fireEvent.click(retry);

    await waitFor(() => {
      expect(createPaymentLink).toHaveBeenCalledWith({
        orderId: "order-1",
        returnUrl: `${window.location.origin}/orders/order-1/return`,
        cancelUrl: `${window.location.origin}/orders/order-1/cancel`,
      });
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(window.location.assign).toHaveBeenCalledWith(
      "https://www.paypal.com/checkoutnow?token=EC-retry",
    );
  });

  it("explains why retry is unavailable when the reservation expired", async () => {
    getOrder.mockResolvedValue(
      pendingOrder({
        items: [
          {
            id: "item-1",
            listingId: "listing-ak",
            sellerId: "seller-1",
            priceSnapshot: 105,
            listing: {
              id: "listing-ak",
              reservationExpiresAt: new Date(Date.now() - 1000).toISOString(),
              product: {
                id: "prod-1",
                weapon: "AK-47",
                skinName: "Redline",
                exterior: "Field-Tested",
              },
            },
          },
        ],
      }),
    );
    renderPage("/orders/order-1/cancel");

    expect(
      await screen.findByText(/reserva deste pedido já expirou/i),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Pagar novamente" }),
    ).toBeNull();
    expect(
      screen.getByText(
        "A reserva expirou. Não é possível pagar novamente neste pedido.",
      ),
    ).toBeTruthy();
  });

  it("surfaces a backend rejection instead of inventing a new order", async () => {
    getOrder.mockResolvedValue(pendingOrder());
    createPaymentLink.mockRejectedValue(new Error("Order is cancelled"));
    renderPage("/orders/order-1");

    fireEvent.click(
      await screen.findByRole("button", { name: "Pagar novamente" }),
    );
    expect(await screen.findByText("Order is cancelled")).toBeTruthy();
    expect(createOrder).not.toHaveBeenCalled();
    expect(screen.queryByText("Pagamento confirmado.")).toBeNull();
  });
});
