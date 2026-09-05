import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../Login";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn(),
    error: null,
    clearError: vi.fn(),
  }),
}));

describe("Login", () => {
  it("labels fields and keeps the submit control disabled-ready", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

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
});
