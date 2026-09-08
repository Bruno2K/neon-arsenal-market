import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing, Product } from "@/types/api";
import { ListingPriceDialog } from "../ListingPriceDialog";

const toast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

function listing(): Listing {
  const catalog: Product = {
    id: "ak-redline-ft",
    game: "CS2",
    weapon: "AK-47",
    skinName: "Redline",
    rarity: "Classified",
    exterior: "Field-Tested",
    isStattrak: false,
    isSouvenir: false,
    imageUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    id: "listing-1",
    productId: catalog.id,
    sellerId: "seller-1",
    floatValue: 0.25,
    price: 18.5,
    currency: "BRL",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    product: catalog,
    seller: { id: "seller-1", storeName: "NeonTrader Store" },
  };
}

describe("ListingPriceDialog", () => {
  beforeEach(() => {
    toast.mockReset();
  });

  it("toasts invalid prices and does not submit", () => {
    const onSubmit = vi.fn();
    render(
      <ListingPriceDialog
        open
        listing={listing()}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Novo Preço"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    expect(toast).toHaveBeenCalledWith({
      title: "Preço inválido",
      variant: "destructive",
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a parsed positive price", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ListingPriceDialog
        open
        listing={listing()}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Novo Preço"), {
      target: { value: "22.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(22.5);
    });
  });
});
