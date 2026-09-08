import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing, Product } from "@/types/api";
import { ListingFormDialog } from "../ListingFormDialog";

const toast = vi.fn();
const listProducts = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

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

function listing(): Listing {
  const catalog = product();
  return {
    id: "listing-1",
    productId: catalog.id,
    sellerId: "seller-1",
    floatValue: 0.25,
    pattern: 123,
    price: 18.5,
    currency: "BRL",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: catalog,
    seller: { id: "seller-1", storeName: "NeonTrader Store" },
  };
}

describe("ListingFormDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    toast.mockReset();
    listProducts.mockReset();
    listProducts.mockResolvedValue({
      items: [product()],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it("validates create input before submitting", async () => {
    const onSubmit = vi.fn();
    render(
      <ListingFormDialog
        open
        listing={null}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(toast).toHaveBeenCalledWith({
      title: "Produto é obrigatório",
      variant: "destructive",
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a create payload after catalog selection", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ListingFormDialog
        open
        listing={null}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(
      await screen.findByRole("option", {
        name: "AK-47 | Redline (Field-Tested)",
      }),
    );
    fireEvent.change(screen.getByLabelText("Float (0-1)"), {
      target: { value: "0.25" },
    });
    fireEvent.change(screen.getByLabelText("Preço (BRL)"), {
      target: { value: "18.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "create",
        input: {
          productId: "ak-redline-ft",
          floatValue: 0.25,
          pattern: undefined,
          price: 18.5,
          tradeLockUntil: undefined,
          steamAssetId: undefined,
        },
      });
    });
  });

  it("shows the product preview and disables float when editing", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ListingFormDialog
        open
        listing={listing()}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(await screen.findByText("Editar listing")).toBeTruthy();
    expect(screen.getByLabelText("Float (0-1)")).toBeDisabled();
    expect(
      screen.getByRole("img", { name: "AK-47 | Redline (Field-Tested)" }),
    ).toHaveAttribute("src", "https://cs2.sh/image/ak-redline.png");

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        mode: "update",
        input: {
          price: 18.5,
          tradeLockUntil: null,
        },
      });
    });
  });
});
