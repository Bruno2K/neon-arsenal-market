import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminOrders from "../AdminOrders";
import type { Order } from "@/types/api";

const listAdminOrders = vi.fn();

vi.mock("@/api/admin", () => ({
  listAdminOrders: (...args: unknown[]) => listAdminOrders(...args),
}));

function order(): Order {
  return {
    id: "order-abcdef12",
    totalAmount: 18.5,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
  };
}

function renderOrders() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminOrders />
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
    expect(screen.getByText("$18.50")).toBeTruthy();
    expect(screen.getByText("PAID")).toBeTruthy();
    expect(listAdminOrders).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
  });
});
