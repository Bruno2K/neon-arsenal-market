import { api } from "./client";
import type { Favorite, Listing } from "@/types/api";

export interface ListFavoritesResponse {
  items: Favorite[];
}

function normalizeFavorites(payload: unknown): Favorite[] {
  if (Array.isArray(payload)) return payload as Favorite[];
  if (
    payload &&
    typeof payload === "object" &&
    "items" in payload &&
    Array.isArray((payload as ListFavoritesResponse).items)
  ) {
    return (payload as ListFavoritesResponse).items;
  }
  return [];
}

export async function listFavorites(): Promise<Favorite[]> {
  const payload = await api.get<Favorite[] | ListFavoritesResponse>(
    "/favorites",
  );
  return normalizeFavorites(payload);
}

export function addFavorite(listingId: string): Promise<Favorite> {
  return api.post<Favorite>("/favorites", { listingId });
}

export function removeFavorite(listingId: string): Promise<void> {
  return api.delete(`/favorites/${listingId}`);
}

export function favoriteListingId(favorite: Favorite): string {
  return favorite.listingId ?? favorite.listing?.id ?? "";
}

export function favoriteListing(favorite: Favorite): Listing | undefined {
  return favorite.listing;
}
