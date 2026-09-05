import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState, ErrorState } from "../page-state";
import { ApiClientError, USER_FACING_NETWORK } from "@/lib/userFacingApiError";

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

  it("maps API errors to Portuguese without leaking the host", () => {
    const error = new ApiClientError(
      "Could not reach API at http://localhost:3001/listings: Failed to fetch",
      { code: "NETWORK" },
    );
    render(<ErrorState title="Erro ao carregar listings" error={error} />);
    expect(screen.getByText(USER_FACING_NETWORK)).toBeTruthy();
    expect(screen.queryByText(/localhost/i)).toBeNull();
    expect(screen.queryByText(/Failed to fetch/i)).toBeNull();
    expect(error.message).toContain("http://localhost:3001");
  });
});
