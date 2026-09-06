import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  CATALOG_PICKER_PAGE_SIZE,
  ProductCatalogPicker,
} from "../ProductCatalogPicker";
import type { Product } from "@/types/api";

const listProducts = vi.fn();

vi.mock("@/api/products", () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}));

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    isStattrak: false,
    isSouvenir: false,
    imageUrl: "https://cs2.sh/image/ak-redline.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ProductCatalogPicker", () => {
  beforeEach(() => {
    listProducts.mockReset();
    listProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      page: 1,
      limit: CATALOG_PICKER_PAGE_SIZE,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fetch the catalog while disabled", () => {
    render(<ProductCatalogPicker enabled disabled onSelect={vi.fn()} />);
    expect(listProducts).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Buscar no catálogo")).toBeNull();
  });

  it("loads one page from GET /products instead of the full catalog", async () => {
    render(<ProductCatalogPicker enabled onSelect={vi.fn()} />);

    expect(
      await screen.findByText("AK-47 | Redline (Field-Tested)"),
    ).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({
      page: 1,
      limit: CATALOG_PICKER_PAGE_SIZE,
    });
    expect(listProducts).not.toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
    expect(screen.getByText("Mostrando 1 de 1")).toBeTruthy();
  });

  it("searches the catalog by weapon, skin, or Steam name", async () => {
    const awp = product({
      id: "awp-asiimov-ft",
      weapon: "AWP",
      skinName: "Asiimov",
      imageUrl: "https://cs2.sh/image/awp-asiimov.png",
    });
    listProducts.mockResolvedValueOnce({
      items: [product()],
      total: 21924,
      page: 1,
      limit: CATALOG_PICKER_PAGE_SIZE,
    });
    listProducts.mockResolvedValue({
      items: [awp],
      total: 4,
      page: 1,
      limit: CATALOG_PICKER_PAGE_SIZE,
    });

    render(<ProductCatalogPicker enabled onSelect={vi.fn()} />);
    expect(await screen.findByText(/AK-47/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Buscar no catálogo"), {
      target: { value: "AWP Asiimov" },
    });

    expect(
      await screen.findByText("AWP | Asiimov (Field-Tested)"),
    ).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({
      page: 1,
      limit: CATALOG_PICKER_PAGE_SIZE,
      search: "AWP Asiimov",
    });
    expect(screen.getByText("Mostrando 1 de 4")).toBeTruthy();
  });

  it("selects a result and keeps catalog thumbnails", async () => {
    const onSelect = vi.fn();
    render(<ProductCatalogPicker enabled onSelect={onSelect} />);

    fireEvent.click(
      await screen.findByRole("option", {
        name: "AK-47 | Redline (Field-Tested)",
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ak-redline-ft" }),
    );
    expect(
      document.querySelector('img[src="https://cs2.sh/image/ak-redline.png"]'),
    ).toBeTruthy();
  });

  it("loads the next page without replacing the current results", async () => {
    const first = product();
    const second = product({
      id: "awp-asiimov-ft",
      weapon: "AWP",
      skinName: "Asiimov",
    });
    listProducts.mockResolvedValueOnce({
      items: [first],
      total: 2,
      page: 1,
      limit: CATALOG_PICKER_PAGE_SIZE,
    });
    listProducts.mockResolvedValueOnce({
      items: [second],
      total: 2,
      page: 2,
      limit: CATALOG_PICKER_PAGE_SIZE,
    });

    render(<ProductCatalogPicker enabled onSelect={vi.fn()} />);
    expect(await screen.findByText(/AK-47/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText(/AWP/)).toBeTruthy();
    expect(screen.getByText(/AK-47/)).toBeTruthy();
    expect(listProducts).toHaveBeenLastCalledWith({
      page: 2,
      limit: CATALOG_PICKER_PAGE_SIZE,
    });
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
    expect(screen.getByText("Mostrando 2 de 2")).toBeTruthy();
  });
});
