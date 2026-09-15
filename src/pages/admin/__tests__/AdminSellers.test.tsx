import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminSellers from "../AdminSellers";
import type { Seller } from "@/types/api";

const listAdminSellers = vi.fn();
const adminApproveSeller = vi.fn();

vi.mock("@/api/admin", () => ({
  listAdminSellers: (...args: unknown[]) => listAdminSellers(...args),
  adminApproveSeller: (...args: unknown[]) => adminApproveSeller(...args),
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
    balance: 25,
    rating: 0,
    isApproved: false,
    user: {
      id: "user-pending",
      name: "Pending Seller",
      email: "pending@test.com",
    },
    ...overrides,
  };
}

function renderSellers() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminSellers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminSellers", () => {
  beforeEach(() => {
    listAdminSellers.mockReset();
    adminApproveSeller.mockReset();
    adminApproveSeller.mockResolvedValue(seller({ isApproved: true }));
  });

  it("lists sellers and approves with adminApproveSeller(id, true)", async () => {
    listAdminSellers.mockResolvedValue([
      seller(),
      seller({
        id: "seller-ok",
        storeName: "Loja Aprovada",
        isApproved: true,
        user: { id: "user-ok", name: "Approved Seller", email: "ok@test.com" },
      }),
    ]);

    renderSellers();

    expect(await screen.findByText("Vendedores")).toBeTruthy();
    expect(screen.getByText("Loja Pendente")).toBeTruthy();
    expect(screen.getByText("Loja Aprovada")).toBeTruthy();
    expect(listAdminSellers).toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Aprovar" }));
    await waitFor(() => {
      expect(adminApproveSeller).toHaveBeenCalledWith("seller-pending", true);
    });
  });

  it("suspends an approved seller with adminApproveSeller(id, false)", async () => {
    listAdminSellers.mockResolvedValue([
      seller({
        id: "seller-ok",
        storeName: "Loja Aprovada",
        isApproved: true,
      }),
    ]);

    renderSellers();

    fireEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    await waitFor(() => {
      expect(adminApproveSeller).toHaveBeenCalledWith("seller-ok", false);
    });
  });
});
