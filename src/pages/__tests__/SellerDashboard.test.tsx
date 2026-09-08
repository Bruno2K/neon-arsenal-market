import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SellerDashboard from "../SellerDashboard";
import type { Listing, Order, Role, Seller, User } from "@/types/api";

const getSellerListings = vi.fn();
const listOrders = vi.fn();
const getCommissionBalance = vi.fn();
const getSellerMe = vi.fn();
const authState = {
  user: {
    id: "seller-user",
    name: "Seller",
    email: "seller@test.com",
    role: "SELLER",
  } as User,
};

vi.mock("@/api/listings", () => ({
  getSellerListings: (...args: unknown[]) => getSellerListings(...args),
}));

vi.mock("@/api/orders", () => ({
  listOrders: (...args: unknown[]) => listOrders(...args),
}));

vi.mock("@/api/commissions", () => ({
  getCommissionBalance: (...args: unknown[]) => getCommissionBalance(...args),
}));

vi.mock("@/api/sellers", () => ({
  getSellerMe: (...args: unknown[]) => getSellerMe(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function listing(status: Listing["status"] = "ACTIVE"): Listing {
  return {
    id: `listing-${status}`,
    productId: "prod-1",
    sellerId: "seller-1",
    floatValue: 0.1,
    price: 10,
    currency: "BRL",
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: {
      id: "prod-1",
      game: "CS2",
      weapon: "AK-47",
      skinName: "Redline",
      rarity: "Classified",
      exterior: "Field-Tested",
      isStattrak: false,
      isSouvenir: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    seller: { id: "seller-1", storeName: "NeonTrader Store" },
  };
}

function sellerMe(overrides: Partial<Seller> = {}): Seller {
  return {
    id: "seller-1",
    userId: "seller-user",
    storeName: "NeonTrader Store",
    commissionRate: "0.1",
    balance: "0.00",
    rating: 0,
    isApproved: true,
    ...overrides,
  };
}

function order(id: string, amount: number): Order {
  return {
    id,
    totalAmount: amount,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `item-${id}`,
        listingId: "listing-1",
        sellerId: "seller-1",
        priceSnapshot: amount,
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

function renderDashboard(role: Role = "SELLER") {
  authState.user = {
    id: `${role}-user`,
    name: role,
    email: `${role.toLowerCase()}@test.com`,
    role,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/seller"]}>
        <Routes>
          <Route path="/seller" element={<SellerDashboard />} />
          <Route path="/admin" element={<div>admin-home</div>} />
          <Route
            path="/seller/transactions"
            element={<div>transactions-page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SellerDashboard", () => {
  beforeEach(() => {
    getSellerListings.mockReset();
    listOrders.mockReset();
    getCommissionBalance.mockReset();
    getSellerMe.mockReset();
  });

  it("shows ledger balance, sellers/me commission rate, and active listings", async () => {
    getSellerListings.mockResolvedValue({
      items: [listing("ACTIVE"), listing("SOLD")],
      total: 2,
    });
    listOrders.mockResolvedValue([order("ord-1", 42), order("ord-2", 42)]);
    getCommissionBalance.mockResolvedValue({ balance: "135.00" });
    getSellerMe.mockResolvedValue(sellerMe({ commissionRate: "0.1" }));

    renderDashboard("SELLER");

    expect(await screen.findByText("Visão geral")).toBeTruthy();
    expect(screen.getByText("Saldo R$ 135.00 · Comissão 10%")).toBeTruthy();
    expect(screen.getByText("Saldo")).toBeTruthy();
    expect(screen.getAllByText("R$ 135.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Comissão")).toBeTruthy();
    expect(screen.getAllByText("10%").length).toBeGreaterThan(0);
    expect(screen.getByText("Listings ativos")).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AK-47 | Redline").length).toBeGreaterThan(0);
    expect(screen.queryByText("Receita")).toBeNull();
    expect(screen.queryByText("R$ 84.00")).toBeNull();
    expect(screen.queryByText(/SKINMARKET/i)).toBeNull();
    expect(screen.queryByText(/CS2 Skin Marketplace/i)).toBeNull();
    expect(getCommissionBalance).toHaveBeenCalled();
    expect(getSellerMe).toHaveBeenCalled();
  });

  it("shows a create-listing CTA when the seller has no recent orders", async () => {
    getSellerListings.mockResolvedValue({ items: [], total: 0 });
    listOrders.mockResolvedValue([]);
    getCommissionBalance.mockResolvedValue({ balance: "0.00" });
    getSellerMe.mockResolvedValue(sellerMe());

    renderDashboard("SELLER");

    expect(await screen.findByText("Nenhum pedido")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Criar listing" })).toHaveAttribute(
      "href",
      "/seller/listings",
    );
  });

  it("does not invent saldo by summing local order totals", async () => {
    getSellerListings.mockResolvedValue({ items: [], total: 0 });
    listOrders.mockResolvedValue([order("ord-1", 50), order("ord-2", 50)]);
    getCommissionBalance.mockResolvedValue({ balance: "0.00" });
    getSellerMe.mockResolvedValue(sellerMe({ commissionRate: "0.15" }));

    renderDashboard("SELLER");

    expect(
      await screen.findByText("Saldo R$ 0.00 · Comissão 15%"),
    ).toBeTruthy();
    expect(screen.getAllByText("R$ 0.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("R$ 100.00")).toBeNull();
    expect(screen.queryByText("Receita")).toBeNull();
  });

  it("retries all seller dashboard queries from the error state", async () => {
    getSellerListings.mockRejectedValue(new Error("boom"));
    listOrders.mockRejectedValue(new Error("boom"));
    getCommissionBalance.mockRejectedValue(new Error("boom"));
    getSellerMe.mockRejectedValue(new Error("boom"));

    renderDashboard("SELLER");

    expect(await screen.findByText("Erro ao carregar o painel")).toBeTruthy();

    getSellerListings.mockResolvedValue({ items: [], total: 0 });
    listOrders.mockResolvedValue([]);
    getCommissionBalance.mockResolvedValue({ balance: "0.00" });
    getSellerMe.mockResolvedValue(sellerMe());

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Visão geral")).toBeTruthy();
    expect(getCommissionBalance.mock.calls.length).toBeGreaterThan(1);
    expect(getSellerMe.mock.calls.length).toBeGreaterThan(1);
  });

  it("redirects ADMIN to /admin instead of showing Seller not found", async () => {
    getSellerListings.mockRejectedValue(new Error("Seller not found"));
    listOrders.mockRejectedValue(new Error("Seller not found"));
    getCommissionBalance.mockRejectedValue(new Error("Seller not found"));
    getSellerMe.mockRejectedValue(new Error("Seller not found"));

    renderDashboard("ADMIN");

    expect(await screen.findByText("admin-home")).toBeTruthy();
    expect(screen.queryByText("Erro ao carregar o painel")).toBeNull();
    expect(screen.queryByText("Seller not found")).toBeNull();
    expect(getSellerListings).not.toHaveBeenCalled();
    expect(listOrders).not.toHaveBeenCalled();
    expect(getCommissionBalance).not.toHaveBeenCalled();
    expect(getSellerMe).not.toHaveBeenCalled();
  });
});
