import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

function renderHeader(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  );
}

describe("Header", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.logout.mockReset();
  });

  it("shows Neon Arsenal brand and storefront links", () => {
    renderHeader();
    expect(screen.getAllByText("Neon Arsenal").length).toBeGreaterThan(0);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Market")).toBeTruthy();
    expect(screen.getByText("Login")).toBeTruthy();
    expect(screen.queryByText("SKINMARKET")).toBeNull();
    expect(screen.getByLabelText("Carrinho")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Menu" })).toBeTruthy();
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
    expect(screen.getByText("Sair")).toBeTruthy();
  });

  it("shows Admin for an admin", () => {
    authState.user = {
      id: "a1",
      name: "Admin",
      email: "admin@test.com",
      role: "ADMIN",
    };
    authState.isAuthenticated = true;
    renderHeader();
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });
});
