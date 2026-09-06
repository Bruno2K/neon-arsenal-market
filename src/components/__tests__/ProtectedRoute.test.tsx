import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../ProtectedRoute";
import type { Role, User } from "@/types/api";

const authState = {
  user: null as User | null,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

const SELLER_ROUTES = [
  "/seller",
  "/seller/listings",
  "/seller/products",
  "/seller/orders",
  "/seller/transactions",
] as const;

function userFor(role: Role): User {
  return {
    id: `${role.toLowerCase()}-user`,
    name: role,
    email: `${role.toLowerCase()}@test.com`,
    role,
  };
}

function renderSellerGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <div>
                <nav aria-label="Painel">seller-chrome</nav>
                <ProtectedRoute allowedRoles={["SELLER"]}>
                  <div>seller-page</div>
                </ProtectedRoute>
              </div>
            </ProtectedRoute>
          }
        >
          <Route path="/seller" element={null} />
          <Route path="/seller/listings" element={null} />
          <Route path="/seller/products" element={null} />
          <Route path="/seller/orders" element={null} />
          <Route path="/seller/transactions" element={null} />
        </Route>
        <Route path="/admin" element={<div>admin-home</div>} />
        <Route path="/login" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute seller surface", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
  });

  it.each(SELLER_ROUTES)(
    "redirects ADMIN from %s to /admin without seller chrome or Acesso negado",
    (path) => {
      authState.user = userFor("ADMIN");
      authState.isAuthenticated = true;

      renderSellerGate(path);

      expect(screen.getByText("admin-home")).toBeTruthy();
      expect(screen.queryByText("seller-chrome")).toBeNull();
      expect(screen.queryByText("seller-page")).toBeNull();
      expect(screen.queryByText("Acesso negado")).toBeNull();
    },
  );

  it.each(SELLER_ROUTES)("keeps SELLER on %s", (path) => {
    authState.user = userFor("SELLER");
    authState.isAuthenticated = true;

    renderSellerGate(path);

    expect(screen.getByText("seller-page")).toBeTruthy();
    expect(screen.getByText("seller-chrome")).toBeTruthy();
    expect(screen.queryByText("admin-home")).toBeNull();
  });

  it("still denies CUSTOMER on /seller with Acesso negado", () => {
    authState.user = userFor("CUSTOMER");
    authState.isAuthenticated = true;

    renderSellerGate("/seller");

    expect(screen.getByText("Acesso negado")).toBeTruthy();
    expect(screen.queryByText("admin-home")).toBeNull();
    expect(screen.queryByText("seller-page")).toBeNull();
  });
});

const ADMIN_ORDER_ROUTES = [
  "/admin/orders",
  "/admin/orders/order-abcdef12",
] as const;

function renderAdminGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <div>admin-page</div>
              </ProtectedRoute>
            </ProtectedRoute>
          }
        >
          <Route path="/admin/orders" element={null} />
          <Route path="/admin/orders/:id" element={null} />
        </Route>
        <Route path="/login" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute admin orders", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = false;
  });

  it.each(ADMIN_ORDER_ROUTES)("keeps ADMIN on %s", (path) => {
    authState.user = userFor("ADMIN");
    authState.isAuthenticated = true;

    renderAdminGate(path);

    expect(screen.getByText("admin-page")).toBeTruthy();
    expect(screen.queryByText("Acesso negado")).toBeNull();
  });

  it.each(["SELLER", "CUSTOMER"] as const)(
    "denies %s on admin order list and detail",
    (role) => {
      authState.user = userFor(role);
      authState.isAuthenticated = true;

      renderAdminGate("/admin/orders/order-abcdef12");

      expect(screen.getByText("Acesso negado")).toBeTruthy();
      expect(screen.queryByText("admin-page")).toBeNull();
    },
  );
});
