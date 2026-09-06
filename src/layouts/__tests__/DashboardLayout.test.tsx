import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardLayout from "../DashboardLayout";
import { SELLER_PENDING_BANNER_TITLE } from "@/components/seller/SellerPendingBanner";
import type { Seller } from "@/types/api";

const getSellerMe = vi.fn();

vi.mock("@/components/Header", () => ({
  Header: () => <div>header</div>,
}));

vi.mock("@/components/SiteFooter", () => ({
  SiteFooter: () => null,
}));

vi.mock("@/api/sellers", () => ({
  getSellerMe: (...args: unknown[]) => getSellerMe(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: { role: "SELLER" },
    isAuthenticated: true,
  }),
  useOptionalAuth: () => ({
    logout: vi.fn(),
    user: { role: "SELLER" },
    isAuthenticated: true,
  }),
}));

function sellerMe(overrides: Partial<Seller> = {}): Seller {
  return {
    id: "seller-1",
    userId: "seller-user",
    storeName: "NeonTrader Store",
    balance: 0,
    rating: 0,
    isApproved: true,
    ...overrides,
  };
}

function renderLayout(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/admin" element={<div>overview</div>} />
            <Route path="/admin/catalog" element={<div>catalog-page</div>} />
            <Route path="/admin/products" element={<div>products-page</div>} />
            <Route path="/admin/orders" element={<div>admin-orders</div>} />
            <Route path="/seller" element={<div>overview</div>} />
            <Route
              path="/seller/transactions"
              element={<div>transactions-page</div>}
            />
            <Route path="/seller/listings" element={<div>listings-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderAdminNav(path: string) {
  return renderLayout(path);
}

function renderSellerNav(path: string) {
  return renderLayout(path);
}

describe("DashboardLayout admin nav", () => {
  beforeEach(() => {
    getSellerMe.mockReset();
  });

  it("exposes Catálogo next to Visão Geral", () => {
    renderAdminNav("/admin");
    const links = screen.getAllByRole("link", { name: "Catálogo" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/admin/catalog");
    expect(
      screen.getAllByRole("link", { name: "Visão Geral" })[0],
    ).toHaveAttribute("href", "/admin");
    expect(getSellerMe).not.toHaveBeenCalled();
  });

  it("exposes Produtos CRUD next to Catálogo", () => {
    renderAdminNav("/admin/products");
    const links = screen.getAllByRole("link", { name: "Produtos" });
    expect(links[0]).toHaveAttribute("href", "/admin/products");
    expect(screen.getByText("products-page")).toBeTruthy();
  });

  it("marks Catálogo current on /admin/catalog", () => {
    renderAdminNav("/admin/catalog");
    const links = screen.getAllByRole("link", { name: "Catálogo" });
    expect(
      links.some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(screen.getByText("catalog-page")).toBeTruthy();
    expect(getSellerMe).not.toHaveBeenCalled();
  });
});

describe("DashboardLayout seller nav", () => {
  beforeEach(() => {
    getSellerMe.mockReset();
    getSellerMe.mockResolvedValue(sellerMe());
  });

  it("exposes Transações next to Visão Geral", async () => {
    renderSellerNav("/seller");
    const links = screen.getAllByRole("link", { name: "Transações" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/seller/transactions");
    expect(
      screen.getAllByRole("link", { name: "Visão Geral" })[0],
    ).toHaveAttribute("href", "/seller");
    expect(await screen.findByText("overview")).toBeTruthy();
    expect(screen.queryByText(SELLER_PENDING_BANNER_TITLE)).toBeNull();
  });

  it("marks Transações current on /seller/transactions", () => {
    renderSellerNav("/seller/transactions");
    const links = screen.getAllByRole("link", { name: "Transações" });
    expect(
      links.some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(screen.getByText("transactions-page")).toBeTruthy();
  });

  it("shows a persistent pending banner from getSellerMe on /seller/*", async () => {
    getSellerMe.mockResolvedValue(sellerMe({ isApproved: false }));

    renderSellerNav("/seller/listings");

    expect(await screen.findByText(SELLER_PENDING_BANNER_TITLE)).toBeTruthy();
    expect(
      screen.getByText("Você poderá anunciar depois que um admin aprovar."),
    ).toBeTruthy();
    expect(screen.getByText("listings-page")).toBeTruthy();
    expect(getSellerMe).toHaveBeenCalled();
    expect(screen.queryByText(/e-?mail/i)).toBeNull();
  });

  it("hides the pending banner after getSellerMe reports approval", async () => {
    getSellerMe.mockResolvedValue(sellerMe({ isApproved: true }));

    renderSellerNav("/seller");

    expect(await screen.findByText("overview")).toBeTruthy();
    expect(screen.queryByText(SELLER_PENDING_BANNER_TITLE)).toBeNull();
  });
});
