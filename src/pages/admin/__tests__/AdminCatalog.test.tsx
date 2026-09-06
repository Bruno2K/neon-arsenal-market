import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminCatalog from "../AdminCatalog";

const getCs2ShImportStatus = vi.fn();
const startCs2ShImport = vi.fn();

vi.mock("@/api/admin", () => ({
  getCs2ShImportStatus: (...args: unknown[]) => getCs2ShImportStatus(...args),
  startCs2ShImport: (...args: unknown[]) => startCs2ShImport(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderCatalog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminCatalog />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminCatalog", () => {
  beforeEach(() => {
    getCs2ShImportStatus.mockReset();
    startCs2ShImport.mockReset();
    getCs2ShImportStatus.mockResolvedValue({
      running: false,
      lastResult: null,
    });
    startCs2ShImport.mockResolvedValue({
      status: "started",
      running: true,
      lastResult: null,
    });
  });

  it("shows the import button without waiting on other admin lists", async () => {
    renderCatalog();

    expect(
      await screen.findByRole("heading", { name: "Catálogo" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Importar catálogo" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Importar catálogo" }));
    await waitFor(() => {
      expect(startCs2ShImport).toHaveBeenCalledTimes(1);
    });
  });
});
