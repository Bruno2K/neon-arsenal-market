import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SellerOrdersPage from "../SellerOrders";
import type { Order, Role, User } from "@/types/api";

const listOrders = vi.fn();
const authState = {
  user: {
    id: "seller-user",
    name: "Seller",
    email: "seller@test.com",
    role: "SELLER",
  } as User,
};

vi.mock("@/api/orders", () => ({
  listOrders: (...args: unknown[]) => listOrders(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function order(): Order {
  return {
    id: "ord-1",
    totalAmount: 42,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "item-1",
        listingId: "listing-1",
        sellerId: "seller-1",
        priceSnapshot: 42,
        listing: {
          id: "listing-1",
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

function setRole(role: Role) {
  authState.user = {
    id: `${role.toLowerCase()}-user`,
    name: role,
    email: `${role.toLowerCase()}@test.com`,
    role,
  };
}

function renderOrders() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/seller/orders"]}>
        <Routes>
          <Route path="/seller/orders" element={<SellerOrdersPage />} />
          <Route path="/admin" element={<div>admin-home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SellerOrders", () => {
  beforeEach(() => {
    listOrders.mockReset();
    setRole("SELLER");
  });

  it("renders the seller order list", async () => {
    listOrders.mockResolvedValue([order()]);

    renderOrders();

    expect(await screen.findByText("Pedidos")).toBeTruthy();
    expect(
      screen.getByText("Pedidos que incluem um listing da sua loja."),
    ).toBeTruthy();
    expect(screen.getByText("Pedido ord-1")).toBeTruthy();
    expect(screen.getByText("AK-47 | Redline")).toBeTruthy();
    expect(listOrders).toHaveBeenCalled();
  });

  it("redirects ADMIN to /admin without rendering seller orders or calling listOrders", async () => {
    setRole("ADMIN");
    listOrders.mockResolvedValue([order()]);

    renderOrders();

    expect(await screen.findByText("admin-home")).toBeTruthy();
    expect(screen.queryByText("Pedidos")).toBeNull();
    expect(screen.queryByText("Pedido ord-1")).toBeNull();
    expect(
      screen.queryByText("Pedidos que incluem um listing da sua loja."),
    ).toBeNull();
    expect(listOrders).not.toHaveBeenCalled();
  });
});
