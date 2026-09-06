import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/userFacingApiError";
import AdminOrderDetail from "../AdminOrderDetail";
import type { Order } from "@/types/api";

const getOrder = vi.fn();

vi.mock("@/api/orders", () => ({
  getOrder: (...args: unknown[]) => getOrder(...args),
}));

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-abcdef12",
    totalAmount: 18.5,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    trackingCode: "BR123456",
    trackingCarrier: "Correios",
    paypalOrderId: "PAYPAL-ORDER-9",
    createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
    customer: {
      id: "cust-1",
      name: "Ana Buyer",
      email: "ana@example.com",
      role: "CUSTOMER",
    },
    items: [
      {
        id: "item-1",
        listingId: "listing-1",
        sellerId: "seller-1",
        priceSnapshot: 18.5,
        listing: {
          id: "listing-1",
          product: {
            id: "prod-1",
            weapon: "AK-47",
            skinName: "Redline",
            exterior: "Field-Tested",
          },
        },
        seller: { id: "seller-1", storeName: "NeonTrader Store" },
      },
    ],
    ...overrides,
  };
}

function renderDetail(path = "/admin/orders/order-abcdef12") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
          <Route path="/admin/orders" element={<div>orders-list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminOrderDetail", () => {
  beforeEach(() => {
    getOrder.mockReset();
  });

  it("shows read-only items, customer, payment, tracking and paypalOrderId", async () => {
    getOrder.mockResolvedValue(order());

    renderDetail();

    expect(await screen.findByText("Pedido #order-ab")).toBeTruthy();
    expect(screen.getByText("AK-47 | Redline (Field-Tested)")).toBeTruthy();
    expect(screen.getByText("Ana Buyer")).toBeTruthy();
    expect(screen.getByText("ana@example.com")).toBeTruthy();
    expect(screen.getByText("Pago")).toBeTruthy();
    expect(screen.getByText("Correios · BR123456")).toBeTruthy();
    expect(screen.getByText("PAYPAL-ORDER-9")).toBeTruthy();
    expect(getOrder).toHaveBeenCalledWith("order-abcdef12");
    expect(screen.queryByRole("button", { name: /reembols/i })).toBeNull();
    expect(screen.queryByText(/PAYPAL_SECRET/i)).toBeNull();
    expect(screen.queryByText(/webhook/i)).toBeNull();
    expect(screen.queryByText(/client secret/i)).toBeNull();
  });

  it("maps a missing order to Portuguese 404 copy", async () => {
    getOrder.mockRejectedValue(
      new ApiClientError("Order not found", { status: 404 }),
    );

    renderDetail("/admin/orders/missing-order");

    expect(await screen.findByText("Pedido não encontrado")).toBeTruthy();
    expect(
      screen.getByText("Este pedido não existe ou não está disponível."),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Voltar aos pedidos" }),
    ).toBeTruthy();
    expect(screen.queryByText(/Order not found/i)).toBeNull();
  });
});
