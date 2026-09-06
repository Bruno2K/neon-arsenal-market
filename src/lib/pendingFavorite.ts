const STORAGE_KEY = "pendingFavoriteListingId";

export function setPendingFavoriteListingId(listingId: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, listingId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function consumePendingFavoriteListingId(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (value) sessionStorage.removeItem(STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
