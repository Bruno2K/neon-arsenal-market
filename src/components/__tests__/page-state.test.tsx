import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState, ErrorState } from "../page-state";

describe("page-state", () => {
  it("exposes empty content as a status region", () => {
    render(<EmptyState title="Nenhum listing" description="Crie um item." />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Nenhum listing")).toBeTruthy();
  });

  it("exposes errors as an alert", () => {
    render(
      <ErrorState title="Erro ao carregar" description="Tente de novo." />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Erro ao carregar")).toBeTruthy();
  });
});
