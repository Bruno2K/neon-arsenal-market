import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Header } from "../Header";
import type { User } from "@/types/api";

const authState = {
  user: null as User | null,
  isAuthenticated: false,
  logout: vi.fn(),
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/contexts/CartContext", () => ({
  useCart: () => ({ totalItems: 0 }),
}));

function LocationEcho() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderHeader(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
      <LocationEcho />
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/products" element={<div>market</div>} />
        <Route path="/login" element={<div>login</div>} />
        <Route path="/register" element={<div>register</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Header", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.logout.mockReset();
  });

  it("exposes skip-to-content as the first focusable control", () => {
    renderHeader();
    const skip = screen.getByRole("link", { name: "Ir para o conteúdo" });
    expect(skip).toHaveAttribute("href", "#conteudo");
    const focusables = document.querySelectorAll(
      "a[href], button, input, [tabindex]:not([tabindex='-1'])",
    );
    expect(focusables[0]).toBe(skip);
  });

  it("hides the storefront hamburger when dashboards own the mobile menu", () => {
    render(
      <MemoryRouter initialEntries={["/seller/listings"]}>
        <Header hideMobileMenu />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Ir para o conteúdo" }),
    ).toBeTruthy();
  });

  it("shows Neon Arsenal brand and storefront links", () => {
    renderHeader();
    expect(screen.getAllByText("Neon Arsenal").length).toBeGreaterThan(0);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Market")).toBeTruthy();
    expect(screen.getByText("Login")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByText("SKINMARKET")).toBeNull();
    expect(screen.queryByRole("link", { name: "Pedidos" })).toBeNull();
    expect(screen.getByLabelText("Carrinho")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-haspopup",
      "true",
    );
  });

  it("shows Dashboard for a seller", () => {
    authState.user = {
      id: "s1",
      name: "Seller",
      email: "seller@test.com",
      role: "SELLER",
    };
    authState.isAuthenticated = true;
    renderHeader();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByRole("link", { name: "Pedidos" })).toBeNull();
    expect(screen.getByRole("link", { name: "Seller" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByText("Sair")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Register" })).toBeNull();
  });

  it("shows Pedidos for an authenticated customer", () => {
    authState.user = {
      id: "c1",
      name: "Buyer",
      email: "buyer@test.com",
      role: "CUSTOMER",
    };
    authState.isAuthenticated = true;
    renderHeader();
    expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute(
      "href",
      "/account/orders",
    );
    expect(screen.getByRole("link", { name: "Favoritos" })).toHaveAttribute(
      "href",
      "/account/favorites",
    );
    expect(screen.getByRole("link", { name: "Buyer" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("shows Admin for an admin", () => {
    authState.user = {
      id: "a1",
      name: "Ada",
      email: "admin@test.com",
      role: "ADMIN",
    };
    authState.isAuthenticated = true;
    renderHeader();
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.getByRole("link", { name: "Ada" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Pedidos" })).toBeNull();
  });

  it("submits header search to /products?q=", () => {
    renderHeader();
    fireEvent.change(screen.getByLabelText("Buscar no Market"), {
      target: { value: "  talon " },
    });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByTestId("location").textContent).toBe(
      "/products?q=talon",
    );
  });

  it("keeps an empty header search on the default Market URL", () => {
    renderHeader("/products?q=talon&exterior=Factory+New");
    fireEvent.change(screen.getByLabelText("Buscar no Market"), {
      target: { value: "   " },
    });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByTestId("location").textContent).toBe("/products");
  });
});
