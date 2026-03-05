import { api } from "./client";
import type { Listing, ListListingsResponse } from "@/types/api";

export interface ListListingsParams {
  page?: number;
  limit?: number;
  productId?: string;
  sellerId?: string;
  status?: "ACTIVE" | "SOLD" | "RESERVED" | "CANCELED";
  minPrice?: number;
  maxPrice?: number;
  minFloat?: number;
  maxFloat?: number;
  exterior?: string;
  isStattrak?: boolean;
}

export function listListings(params?: ListListingsParams): Promise<ListListingsResponse> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.productId) search.set("productId", params.productId);
  if (params?.sellerId) search.set("sellerId", params.sellerId);
  if (params?.status) search.set("status", params.status);
  if (params?.minPrice != null) search.set("minPrice", String(params.minPrice));
  if (params?.maxPrice != null) search.set("maxPrice", String(params.maxPrice));
  if (params?.minFloat != null) search.set("minFloat", String(params.minFloat));
  if (params?.maxFloat != null) search.set("maxFloat", String(params.maxFloat));
  if (params?.exterior) search.set("exterior", params.exterior);
  if (params?.isStattrak !== undefined) search.set("isStattrak", String(params.isStattrak));
  const qs = search.toString();
  return api.get<ListListingsResponse>(`/listings${qs ? `?${qs}` : ""}`);
}

export function getListing(id: string): Promise<Listing> {
  return api.get<Listing>(`/listings/${id}`);
}

export function createListing(body: {
  productId: string;
  floatValue: number;
  pattern?: number;
  price: number;
  currency?: string;
  tradeLockUntil?: string;
  steamAssetId?: string;
}): Promise<Listing> {
  return api.post<Listing>("/listings", body);
}

export function updateListing(
  id: string,
  body: Partial<{
    price: number;
    status: "ACTIVE" | "SOLD" | "RESERVED" | "CANCELED";
    tradeLockUntil: string | null;
  }>
): Promise<Listing> {
  return api.patch<Listing>(`/listings/${id}`, body);
}

export function updateListingPrice(id: string, body: { newPrice: number }): Promise<Listing> {
  return api.patch<Listing>(`/listings/${id}/price`, body);
}

export function reserveListing(id: string): Promise<Listing> {
  return api.post<Listing>(`/listings/${id}/reserve`);
}

export function cancelListing(id: string): Promise<void> {
  return api.post(`/listings/${id}/cancel`);
}

export function getSellerListings(): Promise<{ items: Listing[]; total: number }> {
  return api.get<{ items: Listing[]; total: number }>("/listings/seller/my-listings");
}
