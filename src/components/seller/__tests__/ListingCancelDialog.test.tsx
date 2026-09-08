import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Listing, Product } from "@/types/api";
import { ListingCancelDialog } from "../ListingCancelDialog";

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

describe("ListingCancelDialog", () => {
  it("confirms cancel for the selected listing", () => {
    const onConfirm = vi.fn();
    render(
      <ListingCancelDialog
        listing={listing()}
        deleting={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Cancelar listing?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("stays closed when no listing is selected", () => {
    render(
      <ListingCancelDialog
        listing={null}
        deleting={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText("Cancelar listing?")).toBeNull();
  });
});
