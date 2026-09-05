import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminDashboard from "../AdminDashboard";
import type { Order, Seller } from "@/types/api";

const listAdminOrders = vi.fn();
const adminApproveSeller = vi.fn();
const listSellers = vi.fn();
const listProducts = vi.fn();

vi.mock("@/api/admin", () => ({
  listAdminOrders: (...args: unknown[]) => listAdminOrders(...args),
  adminApproveSeller: (...args: unknown[]) => adminApproveSeller(...args),
}));

vi.mock("@/api/sellers", () => ({
  listSellers: (...args: unknown[]) => listSellers(...args),
}));

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function seller(overrides: Partial<Seller> = {}): Seller {
  return {
    id: "seller-pending",
    userId: "user-pending",
    storeName: "Loja Pendente",
    commissionRate: 0.1,
    balance: 0,
    rating: 4.5,
    isApproved: false,
    user: {
      id: "user-pending",
      name: "Pending Seller",
      email: "pending@test.com",
    },
    ...overrides,
  };
}

function order(): Order {
  return {
    id: "order-abcdef12",
    totalAmount: 42,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-01-15T12:00:00.000Z").toISOString(),
  };
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminDashboard", () => {
  beforeEach(() => {
    listAdminOrders.mockReset();
    adminApproveSeller.mockReset();
    listSellers.mockReset();
    listProducts.mockReset();
    adminApproveSeller.mockResolvedValue(seller({ isApproved: true }));
  });

  it("uses current admin lists and approve contract without leftover marketplace chrome", async () => {
    listSellers.mockResolvedValue([
      seller(),
      seller({
        id: "seller-ok",
        storeName: "Loja Aprovada",
        isApproved: true,
        user: { id: "user-ok", name: "Approved Seller", email: "ok@test.com" },
      }),
    ]);
    listAdminOrders.mockResolvedValue([order()]);
    listProducts.mockResolvedValue({ items: [], total: 12, page: 1, limit: 1 });

    renderDashboard();

    expect(await screen.findByText("Painel admin")).toBeTruthy();
    expect(screen.getByText("Receita")).toBeTruthy();
    expect(screen.getAllByText("$42.00").length).toBeGreaterThan(0);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getAllByText("Loja Pendente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10%").length).toBeGreaterThan(0);
    expect(listSellers).toHaveBeenCalled();
    expect(listAdminOrders).toHaveBeenCalled();
    expect(listProducts).toHaveBeenCalledWith({ limit: 1 });
    expect(screen.queryByText(/SKINMARKET/i)).toBeNull();
    expect(screen.queryByText(/CS2 Skin Marketplace/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => {
      expect(adminApproveSeller).toHaveBeenCalledWith("seller-pending", true);
    });
  });
});
