import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminProducts from "../AdminProducts";
import type { Product } from "@/types/api";

const listProducts = vi.fn();
const createProduct = vi.fn();
const updateProduct = vi.fn();
const deleteProduct = vi.fn();

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
  createProduct: (...args: unknown[]) => createProduct(...args),
  updateProduct: (...args: unknown[]) => updateProduct(...args),
  deleteProduct: (...args: unknown[]) => deleteProduct(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function product(): Product {
  return {
    id: "prod-1",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    collection: "The Phoenix Collection",
    imageUrl: null,
    isStattrak: false,
    isSouvenir: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminProducts", () => {
  beforeEach(() => {
    listProducts.mockReset();
    createProduct.mockReset();
    updateProduct.mockReset();
    deleteProduct.mockReset();
    listProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      page: 1,
      limit: 20,
    });
    createProduct.mockResolvedValue(product());
  });

  it("creates a catalog product through the admin form", async () => {
    renderPage();
    expect(await screen.findByText("AK-47 | Redline")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Novo produto" }));
    fireEvent.change(screen.getByLabelText("Arma"), {
      target: { value: "M4A4" },
    });
    fireEvent.change(screen.getByLabelText("Skin"), {
      target: { value: "Asiimov" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          weapon: "M4A4",
          skinName: "Asiimov",
        }),
      );
    });
  });

  it("asks for confirmation before deleting", async () => {
    renderPage();
    expect(await screen.findByText("AK-47 | Redline")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(screen.getByText("Excluir produto?")).toBeTruthy();
    expect(deleteProduct).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => {
      expect(deleteProduct).toHaveBeenCalledWith("prod-1");
    });
  });
});
