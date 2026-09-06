import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SellerOrdersPage from "../SellerOrders";
import type { Order, Role, User } from "@/types/api";

const listOrders = vi.fn();
const updateOrderTracking = vi.fn();
const updateOrderStatus = vi.fn();
const toast = vi.fn();
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
  updateOrderTracking: (...args: unknown[]) => updateOrderTracking(...args),
  updateOrderStatus: (...args: unknown[]) => updateOrderStatus(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
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
    updateOrderTracking.mockReset();
    updateOrderStatus.mockReset();
    toast.mockReset();
    setRole("SELLER");
  });

  it("shows a create-listing CTA when there are no orders", async () => {
    listOrders.mockResolvedValue([]);

    renderOrders();

    expect(await screen.findByText("Nenhum pedido")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Criar listing" })).toHaveAttribute(
      "href",
      "/seller/listings",
    );
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

  it("saves tracking through updateOrderTracking and never calls updateOrderStatus", async () => {
    listOrders.mockResolvedValue([order()]);
    updateOrderTracking.mockResolvedValue({
      ...order(),
      trackingCode: "TR-1",
      trackingCarrier: "Trade",
    });

    renderOrders();
    expect(await screen.findByText("Pedido ord-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Informar envio" }));
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "TR-1" },
    });
    fireEvent.change(screen.getByLabelText("Transportadora / método"), {
      target: { value: "Trade" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(updateOrderTracking).toHaveBeenCalledWith("ord-1", {
        trackingCode: "TR-1",
        trackingCarrier: "Trade",
      });
    });
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
