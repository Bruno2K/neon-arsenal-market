import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SellerProductsPage from "../SellerProducts";
import type { Product } from "@/types/api";

const listProducts = vi.fn();

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}));

function product(): Product {
  return {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    collection: "The Huntsman Collection",
    imageUrl: null,
    isStattrak: false,
    isSouvenir: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderProducts() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SellerProductsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SellerProducts", () => {
  beforeEach(() => {
    listProducts.mockReset();
  });

  it("renders a read-only product catalog from listProducts", async () => {
    listProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderProducts();

    expect(await screen.findByText("Produtos")).toBeTruthy();
    expect(screen.getByText("AK-47 | Redline")).toBeTruthy();
    expect(screen.getByText("Classified")).toBeTruthy();
    expect(screen.getByText("The Huntsman Collection")).toBeTruthy();
    expect(
      screen.getByText("Ir para listings").closest("a")?.getAttribute("href"),
    ).toBe("/seller/listings");
    expect(listProducts).toHaveBeenCalled();
  });

  it("does not expose listing or product mutations", async () => {
    listProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderProducts();
    await screen.findByText("AK-47 | Redline");

    expect(screen.queryByText("Novo Listing")).toBeNull();
    expect(screen.queryByText("Create Listing")).toBeNull();
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Excluir")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /criar|salvar|excluir/i }),
    ).toBeNull();
  });
});
