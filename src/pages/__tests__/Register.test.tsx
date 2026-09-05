import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Register from "../Register";

const startRegistration = vi.fn();
const confirmRegistration = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    startRegistration,
    confirmRegistration,
    error: null,
    clearError: vi.fn(),
  }),
}));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<div>landed-home</div>} />
        <Route path="/seller" element={<div>landed-seller</div>} />
        <Route path="/admin" element={<div>landed-admin</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Register", () => {
  beforeEach(() => {
    startRegistration.mockReset();
    confirmRegistration.mockReset();
    startRegistration.mockResolvedValue({ message: "ok", code: "123456" });
    confirmRegistration.mockResolvedValue(undefined);
  });

  it("does not offer ADMIN as a public registration role", () => {
    renderRegister();
    expect(screen.getByText("Comprador")).toBeTruthy();
    expect(screen.getByText("Vendedor")).toBeTruthy();
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.queryByText("ADMIN")).toBeNull();
  });

  it("sends a customer to home after email verify", async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "secret1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código por e-mail" }),
    );

    expect(await screen.findByLabelText("Código")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("landed-home")).toBeTruthy();
    expect(screen.queryByText("landed-seller")).toBeNull();
  });

  it("sends a seller to /seller after email verify", async () => {
    renderRegister();
    fireEvent.click(screen.getByText("Vendedor"));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Loja" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "loja@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Nome da loja"), {
      target: { value: "Neon Trader" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código por e-mail" }),
    );

    expect(await screen.findByLabelText("Código")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("landed-seller")).toBeTruthy();
    expect(screen.queryByText("landed-home")).toBeNull();
    expect(screen.queryByText("landed-admin")).toBeNull();
  });
});
