import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "../Login";
import type { Role, User } from "@/types/api";
import { CHECKOUT_BUYER_ONLY_COPY } from "@/lib/postLoginPath";

const login = vi.fn();
const toast = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login,
    error: null,
    clearError: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

function authedUser(role: Role): User {
  return {
    id: `${role}-1`,
    name: role,
    email: `${role.toLowerCase()}@test.com`,
    role,
  };
}

function renderLogin(from?: string, asString = false) {
  const entry =
    from === undefined
      ? "/login"
      : {
          pathname: "/login",
          state: { from: asString ? from : { pathname: from } },
        };

  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>landed-home</div>} />
        <Route path="/seller" element={<div>landed-seller</div>} />
        <Route path="/admin" element={<div>landed-admin</div>} />
        <Route path="/checkout" element={<div>landed-checkout</div>} />
        <Route path="/seller/listings" element={<div>landed-listings</div>} />
        <Route path="/listing/:id" element={<div>landed-listing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitAs(role: Role) {
  login.mockResolvedValue(authedUser(role));
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "user@test.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "secret1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Login", () => {
  beforeEach(() => {
    login.mockReset();
    toast.mockReset();
  });

  it("labels fields and keeps the submit control disabled-ready", () => {
    renderLogin();

    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByLabelText("Senha")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Neon Arsenal, página inicial" }),
    ).toHaveAttribute("href", "/");
    expect(screen.queryByText(/SKINMARKET/i)).toBeNull();
    expect(screen.queryByText(/CS2 Skin Marketplace/i)).toBeNull();
    expect(document.querySelector(".scan-lines")).toBeNull();
    expect(document.querySelector(".neon-text")).toBeNull();
  });

  it("sends admin without from to /admin", async () => {
    renderLogin();
    await submitAs("ADMIN");
    expect(await screen.findByText("landed-admin")).toBeTruthy();
  });

  it("sends admin with from=/seller/listings to /admin", async () => {
    renderLogin("/seller/listings");
    await submitAs("ADMIN");
    expect(await screen.findByText("landed-admin")).toBeTruthy();
    expect(screen.queryByText("landed-listings")).toBeNull();
  });

  it("sends seller without from to /seller", async () => {
    renderLogin();
    await submitAs("SELLER");
    expect(await screen.findByText("landed-seller")).toBeTruthy();
  });

  it("returns a customer to a safe listing path from a string from", async () => {
    renderLogin("/listing/listing-1", true);
    await submitAs("CUSTOMER");
    expect(await screen.findByText("landed-listing")).toBeTruthy();
  });

  it("rejects an external from string", async () => {
    renderLogin("https://evil.example", true);
    await submitAs("CUSTOMER");
    expect(await screen.findByText("landed-home")).toBeTruthy();
  });

  it("sends customer with from=/checkout to /checkout", async () => {
    renderLogin("/checkout");
    await submitAs("CUSTOMER");
    expect(await screen.findByText("landed-checkout")).toBeTruthy();
  });

  it("sends seller away from checkout with buyer-only copy", async () => {
    renderLogin("/checkout");
    await submitAs("SELLER");
    expect(await screen.findByText("landed-seller")).toBeTruthy();
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: CHECKOUT_BUYER_ONLY_COPY,
      });
    });
  });
});
