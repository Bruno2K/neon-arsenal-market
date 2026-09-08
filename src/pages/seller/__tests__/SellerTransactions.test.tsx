import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SellerTransactionsPage from "../SellerTransactions";
import type { Role, SellerTransaction, User } from "@/types/api";

const listCommissionTransactions = vi.fn();
const getSellerMe = vi.fn();
const authState = {
  user: {
    id: "seller-user",
    name: "Seller",
    email: "seller@test.com",
    role: "SELLER",
  } as User,
};

vi.mock("@/api/commissions", () => ({
  listCommissionTransactions: (...args: unknown[]) =>
    listCommissionTransactions(...args),
}));

vi.mock("@/api/sellers", () => ({
  getSellerMe: (...args: unknown[]) => getSellerMe(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function transaction(
  overrides: Partial<SellerTransaction> = {},
): SellerTransaction {
  return {
    id: "tx-1",
    sellerId: "seller-1",
    orderId: "ord-1",
    grossAmount: "100.00",
    commissionAmount: "10.00",
    netAmount: "90.00",
    status: "PAID",
    createdAt: "2026-09-01T12:00:00.000Z",
    order: { id: "ord-1", createdAt: "2026-09-01T11:00:00.000Z" },
    ...overrides,
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

function renderTransactions() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/seller/transactions"]}>
        <Routes>
          <Route
            path="/seller/transactions"
            element={<SellerTransactionsPage />}
          />
          <Route path="/admin" element={<div>admin-home</div>} />
          <Route path="/seller/listings" element={<div>listings-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SellerTransactions", () => {
  beforeEach(() => {
    listCommissionTransactions.mockReset();
    getSellerMe.mockReset();
    getSellerMe.mockResolvedValue({
      id: "seller-1",
      userId: "seller-user",
      storeName: "NeonTrader Store",
      balance: 0,
      rating: 0,
      isApproved: true,
    });
    setRole("SELLER");
  });

  it("renders date, status, and net amount from the commissions payload", async () => {
    listCommissionTransactions.mockResolvedValue([transaction()]);

    renderTransactions();

    expect(await screen.findByText("Transações")).toBeTruthy();
    expect(screen.getByText("Pago")).toBeTruthy();
    expect(screen.getByText("R$ 90.00")).toBeTruthy();
    expect(screen.queryByText("R$ 100.00")).toBeNull();
    expect(listCommissionTransactions).toHaveBeenCalled();
  });

  it("shows the empty next-step copy instead of a broken table", async () => {
    listCommissionTransactions.mockResolvedValue([]);

    renderTransactions();

    expect(
      await screen.findByText(
        "Quando um pedido for pago, o movimento aparece aqui.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("link", { name: "Criar listing" })).toHaveAttribute(
      "href",
      "/seller/listings",
    );
  });

  it("does not push a pending seller to create a listing", async () => {
    listCommissionTransactions.mockResolvedValue([]);
    getSellerMe.mockResolvedValue({
      id: "seller-1",
      userId: "seller-user",
      storeName: "NeonTrader Store",
      balance: 0,
      rating: 0,
      isApproved: false,
    });

    renderTransactions();

    expect(
      await screen.findByText(
        "Quando um pedido for pago, o movimento aparece aqui.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Criar listing" })).toBeNull();
  });

  it("retries the transactions query from the error state", async () => {
    listCommissionTransactions.mockRejectedValue(new Error("boom"));

    renderTransactions();

    expect(await screen.findByText("Erro ao carregar transações")).toBeTruthy();

    listCommissionTransactions.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByText(
        "Quando um pedido for pago, o movimento aparece aqui.",
      ),
    ).toBeTruthy();
  });

  it("redirects ADMIN to /admin without calling listCommissionTransactions", async () => {
    setRole("ADMIN");
    listCommissionTransactions.mockResolvedValue([transaction()]);

    renderTransactions();

    expect(await screen.findByText("admin-home")).toBeTruthy();
    expect(screen.queryByText("Transações")).toBeNull();
    expect(listCommissionTransactions).not.toHaveBeenCalled();
  });
});
