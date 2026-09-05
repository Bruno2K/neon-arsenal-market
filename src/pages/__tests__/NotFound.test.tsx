import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "../NotFound";

describe("NotFound", () => {
  it("shows a Portuguese empty state without leftover marketplace chrome", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByText("Página não encontrada")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Voltar ao início" }),
    ).toHaveAttribute("href", "/");
    expect(screen.queryByText(/SKINMARKET/i)).toBeNull();
    expect(screen.queryByText(/Page not found/i)).toBeNull();
  });
});
