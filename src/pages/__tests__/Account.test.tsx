import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AccountPage from "../Account";
import type { Role, User } from "@/types/api";
import { USER_FACING_NETWORK } from "@/lib/userFacingApiError";

const getMe = vi.fn();
const updateProfile = vi.fn();
const logout = vi.fn();
const toast = vi.fn();

const authState = {
  user: {
    id: "customer-1",
    name: "Buyer",
    email: "buyer@test.com",
    role: "CUSTOMER",
  } as User,
  updateProfile: (...args: unknown[]) => updateProfile(...args),
  logout: (...args: unknown[]) => logout(...args),
};

const getSellerMe = vi.fn();
const applySeller = vi.fn();

vi.mock("@/api/users", () => ({
  getMe: (...args: unknown[]) => getMe(...args),
  updateMe: vi.fn(),
}));

vi.mock("@/api/sellers", () => ({
  getSellerMe: (...args: unknown[]) => getSellerMe(...args),
  applySeller: (...args: unknown[]) => applySeller(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

function profile(overrides: Partial<User> = {}): User {
  return {
    id: "customer-1",
    name: "Buyer",
    email: "buyer@test.com",
    role: "CUSTOMER",
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/orders" element={<div>orders-page</div>} />
          <Route
            path="/account/favorites"
            element={<div>favorites-page</div>}
          />
          <Route path="/seller" element={<div>seller-dash</div>} />
          <Route path="/admin" element={<div>admin-dash</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AccountPage", () => {
  beforeEach(() => {
    getMe.mockReset();
    updateProfile.mockReset();
    logout.mockReset();
    toast.mockReset();
    getSellerMe.mockReset();
    applySeller.mockReset();
    getSellerMe.mockRejectedValue(new Error("not a seller"));
    setRole("CUSTOMER");
    getMe.mockResolvedValue(profile());
    updateProfile.mockImplementation(async (input: { name?: string }) => {
      const next = profile({
        ...authState.user,
        ...input,
      });
      authState.user = next;
      return next;
    });
  });

  it("shows a form skeleton while GET /users/me loads", () => {
    getMe.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(
      screen.getByRole("status", { name: "Carregando conta" }),
    ).toBeTruthy();
  });

  it("disables submit until the profile changes", async () => {
    renderPage();
    expect(await screen.findByLabelText("Nome")).toHaveValue("Buyer");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Novo Nome" },
    });
    expect(screen.getByRole("button", { name: "Salvar" })).not.toBeDisabled();
  });

  it("calls PATCH via updateProfile and toasts Dados salvos", async () => {
    renderPage();
    await screen.findByLabelText("Nome");

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Novo Nome" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({ name: "Novo Nome" });
    });
    expect(toast).toHaveBeenCalledWith({ description: "Dados salvos" });
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("shows per-field Portuguese validation", async () => {
    renderPage();
    await screen.findByLabelText("Nome");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "nao-e-email" },
    });
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Informe um nome")).toBeTruthy();
    expect(screen.getByText("Informe um e-mail válido")).toBeTruthy();
    expect(
      screen.getByText("A senha deve ter pelo menos 6 caracteres"),
    ).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("maps a profile load failure to PT copy with retry", async () => {
    getMe.mockRejectedValueOnce(
      new Error(
        "Could not reach API at http://localhost:3001/users/me: Failed to fetch",
      ),
    );
    renderPage();

    expect(await screen.findByText("Erro ao carregar conta")).toBeTruthy();
    expect(screen.getByText(USER_FACING_NETWORK)).toBeTruthy();
    expect(screen.queryByText(/localhost/i)).toBeNull();

    getMe.mockResolvedValue(profile());
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByLabelText("Nome")).toBeTruthy();
  });

  it("shows Meus pedidos for CUSTOMER and not Dashboard", async () => {
    renderPage();
    expect(
      await screen.findByRole("link", { name: "Meus pedidos" }),
    ).toHaveAttribute("href", "/account/orders");
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });

  it("shows Dashboard for SELLER and not Meus pedidos", async () => {
    setRole("SELLER");
    getMe.mockResolvedValue(profile({ role: "SELLER", name: "Seller" }));
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("href", "/seller");
    expect(screen.queryByRole("link", { name: "Meus pedidos" })).toBeNull();
  });

  it("shows Dashboard for ADMIN", async () => {
    setRole("ADMIN");
    getMe.mockResolvedValue(profile({ role: "ADMIN", name: "Admin" }));
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Meus pedidos" })).toBeNull();
  });

  it("lets a CUSTOMER apply as seller via POST /sellers/apply", async () => {
    applySeller.mockResolvedValue({
      id: "seller-new",
      userId: "customer-1",
      storeName: "Loja Nova",
      balance: 0,
      rating: 0,
      isApproved: false,
    });
    getSellerMe
      .mockRejectedValueOnce(new Error("not a seller"))
      .mockResolvedValue({
        id: "seller-new",
        userId: "customer-1",
        storeName: "Loja Nova",
        balance: 0,
        rating: 0,
        isApproved: false,
      });

    renderPage();
    expect(await screen.findByText("Quero vender")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nome da loja"), {
      target: { value: "Loja Nova" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar candidatura" }));

    await waitFor(() => {
      expect(applySeller).toHaveBeenCalledWith({ storeName: "Loja Nova" });
    });
    expect(
      await screen.findByText(/Aguardando aprovação de um admin/),
    ).toBeTruthy();
    expect(screen.queryByText(/e-mail de aprovação/i)).toBeNull();
  });

  it("logout from the account page uses AuthContext.logout", async () => {
    renderPage();
    await screen.findByLabelText("Nome");
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
