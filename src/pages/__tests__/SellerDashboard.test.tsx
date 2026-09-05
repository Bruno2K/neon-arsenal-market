import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SellerDashboard from "../SellerDashboard";
import type { Listing, Order, Role, User } from "@/types/api";

const getSellerListings = vi.fn();
const listOrders = vi.fn();
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
    currency: "USD",
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SellerDashboard", () => {
  beforeEach(() => {
    getSellerListings.mockReset();
    listOrders.mockReset();
  });

  it("shows listing, revenue and order stats without leftover marketplace chrome", async () => {
    getSellerListings.mockResolvedValue({
      items: [listing("ACTIVE"), listing("SOLD")],
      total: 2,
    });
    listOrders.mockResolvedValue([order("ord-1", 42)]);

    renderDashboard("SELLER");

    expect(await screen.findByText("Visão geral")).toBeTruthy();
    expect(screen.getByText("Listings ativos")).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$42.00").length).toBeGreaterThan(0);
    expect(screen.getByText("AK-47 | Redline")).toBeTruthy();
    expect(screen.queryByText(/SKINMARKET/i)).toBeNull();
    expect(screen.queryByText(/CS2 Skin Marketplace/i)).toBeNull();
  });

  it("redirects ADMIN to /admin instead of showing Seller not found", async () => {
    getSellerListings.mockRejectedValue(new Error("Seller not found"));
    listOrders.mockRejectedValue(new Error("Seller not found"));

    renderDashboard("ADMIN");

    expect(await screen.findByText("admin-home")).toBeTruthy();
    expect(screen.queryByText("Erro ao carregar o painel")).toBeNull();
    expect(screen.queryByText("Seller not found")).toBeNull();
    expect(getSellerListings).not.toHaveBeenCalled();
    expect(listOrders).not.toHaveBeenCalled();
  });
});
