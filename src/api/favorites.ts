import { api } from "./client";
import type { AddFavoriteResponse, Favorite, Listing } from "@/types/api";

export interface ListFavoritesResponse {
  items: Favorite[];
}

function asFavorite(value: unknown): Favorite | null {
  if (!value || typeof value !== "object") return null;
  const listingId = favoriteListingId(value as Favorite);
  if (!listingId) return null;
  return value as Favorite;
}

function normalizeFavorites(payload: unknown): Favorite[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => {
      const favorite = asFavorite(item);
      return favorite ? [favorite] : [];
    });
  }
  if (
    payload &&
    typeof payload === "object" &&
    "items" in payload &&
    Array.isArray((payload as ListFavoritesResponse).items)
  ) {
    return normalizeFavorites((payload as ListFavoritesResponse).items);
  }
  return [];
}

export async function listFavorites(): Promise<Favorite[]> {
  const payload = await api.get<Favorite[] | ListFavoritesResponse>(
    "/favorites",
  );
  return normalizeFavorites(payload);
}

export function addFavorite(listingId: string): Promise<AddFavoriteResponse> {
  return api.post<AddFavoriteResponse>("/favorites", { listingId });
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
