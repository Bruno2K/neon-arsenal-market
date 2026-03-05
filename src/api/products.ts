import { api } from "./client";
import type { Product, ListProductsResponse } from "@/types/api";

export interface ListProductsParams {
  page?: number;
  limit?: number;
  game?: string;
  weapon?: string;
  exterior?: string;
  rarity?: string;
  isStattrak?: boolean;
  search?: string;
}

export function listProducts(params?: ListProductsParams): Promise<ListProductsResponse> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.game) search.set("game", params.game);
  if (params?.weapon) search.set("weapon", params.weapon);
  if (params?.exterior) search.set("exterior", params.exterior);
  if (params?.rarity) search.set("rarity", params.rarity);
  if (params?.isStattrak !== undefined) search.set("isStattrak", String(params.isStattrak));
  if (params?.search) search.set("search", params.search);
  const qs = search.toString();
  return api.get<ListProductsResponse>(`/products${qs ? `?${qs}` : ""}`);
}

export function getProduct(id: string): Promise<Product> {
  return api.get<Product>(`/products/${id}`);
}

export function createProduct(body: {
  game?: string;
  weapon: string;
  skinName: string;
  rarity: string;
  exterior: string;
  collection?: string;
  imageUrl?: string;
  isStattrak?: boolean;
  isSouvenir?: boolean;
}): Promise<Product> {
  return api.post<Product>("/products", body);
}

export function updateProduct(
  id: string,
  body: Partial<{
    game: string;
    weapon: string;
    skinName: string;
    rarity: string;
    exterior: string;
    collection: string | null;
    imageUrl: string | null;
    isStattrak: boolean;
    isSouvenir: boolean;
  }>
): Promise<Product> {
  return api.patch<Product>(`/products/${id}`, body);
}

export function deleteProduct(id: string): Promise<void> {
  return api.delete(`/products/${id}`);
}
