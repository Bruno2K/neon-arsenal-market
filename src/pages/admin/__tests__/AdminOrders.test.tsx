import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminOrders from "../AdminOrders";
import type { Order } from "@/types/api";

const listAdminOrders = vi.fn();

vi.mock("@/api/admin", () => ({
  listAdminOrders: (...args: unknown[]) => listAdminOrders(...args),
}));

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-abcdef12",
    totalAmount: 18.5,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
    ...overrides,
  };
}

function renderOrders(path = "/admin/orders") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/orders" element={<AdminOrders />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminOrders", () => {
  beforeEach(() => {
    listAdminOrders.mockReset();
  });

  it("lists admin orders without extra actions", async () => {
    listAdminOrders.mockResolvedValue([order()]);

    renderOrders();

    expect(await screen.findByText("Pedidos")).toBeTruthy();
    expect(screen.getByText("#order-ab")).toBeTruthy();
    expect(screen.getByText("R$ 18.50")).toBeTruthy();
    expect(screen.getAllByText("Pago").length).toBeGreaterThan(0);
    expect(listAdminOrders).toHaveBeenCalledWith({});
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /reembols/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /reembols/i })).toBeNull();
    expect(screen.getByRole("link", { name: "#order-ab" })).toHaveAttribute(
      "href",
      "/admin/orders/order-abcdef12",
    );
  });

  it("sends URL query filters to GET /admin/orders", async () => {
    listAdminOrders.mockResolvedValue([]);

    renderOrders("/admin/orders?status=PENDING&paymentStatus=PENDING");

    expect(await screen.findByText("Nenhum pedido neste filtro")).toBeTruthy();
    expect(screen.getByText("Tente ajustar os filtros")).toBeTruthy();
    expect(listAdminOrders).toHaveBeenCalledWith({
      status: "PENDING",
      paymentStatus: "PENDING",
    });
    expect(screen.getByLabelText("Status")).toHaveValue("PENDING");
    expect(screen.getByLabelText("Pagamento")).toHaveValue("PENDING");
  });

  it("distinguishes an empty platform from an empty filter", async () => {
    listAdminOrders.mockResolvedValue([]);

    renderOrders();

    expect(await screen.findByText("Nenhum pedido encontrado")).toBeTruthy();
    expect(screen.queryByText("Nenhum pedido neste filtro")).toBeNull();
    expect(screen.queryByText("Tente ajustar os filtros")).toBeNull();
  });

  it("updates the URL when a payment filter is chosen", async () => {
    listAdminOrders.mockResolvedValue([order()]);

    renderOrders();
    expect(await screen.findByText("#order-ab")).toBeTruthy();

    listAdminOrders.mockResolvedValue([]);
    fireEvent.change(screen.getByLabelText("Pagamento"), {
      target: { value: "PENDING" },
    });

    expect(await screen.findByText("Nenhum pedido neste filtro")).toBeTruthy();
    expect(listAdminOrders).toHaveBeenCalledWith({ paymentStatus: "PENDING" });
  });
});
