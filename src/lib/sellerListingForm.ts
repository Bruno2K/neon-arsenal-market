import type { Listing } from "@/types/api";

export const emptyListingForm = {
  productId: "",
  floatValue: "",
  pattern: "",
  price: "",
  tradeLockUntil: "",
  steamAssetId: "",
};

export type ListingFormValues = typeof emptyListingForm;

export type ListingFormIssue =
  | "Produto é obrigatório"
  | "Float deve estar entre 0 e 1"
  | "Preço inválido"
  | "Pattern inválido";

export type ParsedListingForm = {
  floatValue: number;
  price: number;
  pattern?: number;
};

export function listingToForm(listing: Listing): ListingFormValues {
  return {
    productId: listing.productId,
    floatValue: String(listing.floatValue),
    pattern: listing.pattern ? String(listing.pattern) : "",
    price: String(listing.price),
    tradeLockUntil: listing.tradeLockUntil
      ? new Date(listing.tradeLockUntil).toISOString().slice(0, 16)
      : "",
    steamAssetId: listing.steamAssetId || "",
  };
}

export function parseListingForm(
  form: ListingFormValues,
): { title: ListingFormIssue } | { value: ParsedListingForm } {
  const floatValue = parseFloat(form.floatValue);
  const price = parseFloat(form.price);
  const pattern = form.pattern ? parseInt(form.pattern, 10) : undefined;

  if (!form.productId) {
    return { title: "Produto é obrigatório" };
  }
  if (isNaN(floatValue) || floatValue < 0 || floatValue > 1) {
    return { title: "Float deve estar entre 0 e 1" };
  }
  if (isNaN(price) || price <= 0) {
    return { title: "Preço inválido" };
  }
  if (pattern !== undefined && (isNaN(pattern) || pattern < 0)) {
    return { title: "Pattern inválido" };
  }

  return { value: { floatValue, price, pattern } };
}

export function parseListingPrice(
  raw: string,
): { title: "Preço inválido" } | { price: number } {
  const price = parseFloat(raw);
  if (isNaN(price) || price <= 0) {
    return { title: "Preço inválido" };
  }
  return { price };
}
