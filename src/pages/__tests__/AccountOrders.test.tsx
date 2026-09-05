import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AccountOrdersPage, {
  AccountOrderDetailRedirect,
} from "../AccountOrders";
import type { Order, Role, User } from "@/types/api";
import { USER_FACING_NETWORK } from "@/lib/userFacingApiError";

const listOrders = vi.fn();
const updateOrderStatus = vi.fn();
const authState = {
  user: {
    id: "customer-1",
    name: "Buyer",
    email: "buyer@test.com",
    role: "CUSTOMER",
  } as User,
};

vi.mock("@/api/orders", () => ({
  listOrders: (...args: unknown[]) => listOrders(...args),
  updateOrderStatus: (...args: unknown[]) => updateOrderStatus(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

const CREATED_AT = "2026-03-20T15:00:00.000Z";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    totalAmount: 105,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    items: [
      {
        id: "item-1",
        listingId: "listing-ak",
        sellerId: "seller-1",
        priceSnapshot: 105,
        listing: {
          id: "listing-ak",
          product: {
            id: "prod-1",
            weapon: "AK-47",
            skinName: "Redline",
            exterior: "Field-Tested",
          },
        },
      },
    ],
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

function renderPage(path = "/account/orders") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/orders" element={<AccountOrdersPage />} />
          <Route
            path="/account/orders/:id"
            element={<AccountOrderDetailRedirect />}
          />
          <Route path="/orders/:id" element={<div>Pedido destino</div>} />
          <Route path="/seller/orders" element={<div>seller-orders</div>} />
          <Route path="/admin/orders" element={<div>admin-orders</div>} />
          <Route path="/products" element={<div>Market</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AccountOrdersPage", () => {
  beforeEach(() => {
    listOrders.mockReset();
    updateOrderStatus.mockReset();
    setRole("CUSTOMER");
  });

  it("shows a skeleton while orders load", () => {
    listOrders.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(
      screen.getByRole("status", { name: "Carregando pedidos" }),
    ).toBeTruthy();
  });

  it("lists the customer orders returned by GET /orders without a client filter", async () => {
    listOrders.mockResolvedValue([order()]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Pedidos" }),
    ).toBeTruthy();
    expect(listOrders).toHaveBeenCalledWith();
    expect(
      screen.getByRole("link", { name: /AK-47 \| Redline \(Field-Tested\)/ }),
    ).toHaveAttribute("href", "/orders/order-1");
    expect(screen.getByText("Confirmado")).toBeTruthy();
    expect(screen.getByText("Pago")).toBeTruthy();
    expect(screen.getByText("$105.00")).toBeTruthy();
    expect(
      screen.getByText(new Date(CREATED_AT).toLocaleDateString("pt-BR")),
    ).toBeTruthy();
    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /atualizar status|enviar/i }),
    ).toBeNull();
  });

  it("shows the empty buyer copy and a Market CTA", async () => {
    listOrders.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Você ainda não comprou")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ir ao Market" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.queryByText("seller-orders")).toBeNull();
    expect(screen.queryByText("admin-orders")).toBeNull();
  });

  it("maps a network failure to PT copy with retry", async () => {
    listOrders.mockRejectedValue(
      new Error(
        "Could not reach API at http://localhost:3001/orders: Failed to fetch",
      ),
    );
    renderPage();

    expect(await screen.findByText("Erro ao carregar pedidos")).toBeTruthy();
    expect(screen.getByText(USER_FACING_NETWORK)).toBeTruthy();
    expect(screen.queryByText(/localhost/i)).toBeNull();
    listOrders.mockResolvedValue([order()]);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByRole("link", {
        name: /AK-47 \| Redline \(Field-Tested\)/,
      }),
    ).toBeTruthy();
  });

  it("redirects SELLER to the seller order dashboard without calling listOrders", async () => {
    setRole("SELLER");
    listOrders.mockResolvedValue([order()]);
    renderPage();

    expect(await screen.findByText("seller-orders")).toBeTruthy();
    expect(screen.queryByText("Você ainda não comprou")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Pedidos" })).toBeNull();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it("redirects ADMIN to the admin order dashboard without calling listOrders", async () => {
    setRole("ADMIN");
    listOrders.mockResolvedValue([order()]);
    renderPage();

    expect(await screen.findByText("admin-orders")).toBeTruthy();
    expect(screen.queryByText("Você ainda não comprou")).toBeNull();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it("reuses /orders/:id for account detail so PayPal return URLs stay put", async () => {
    renderPage("/account/orders/order-1");
    expect(await screen.findByText("Pedido destino")).toBeTruthy();
  });
});
