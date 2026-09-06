import { afterEach, describe, expect, it } from "vitest";
import {
  consumePendingFavoriteListingId,
  setPendingFavoriteListingId,
} from "../pendingFavorite";

describe("pendingFavorite", () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("stores one listing in sessionStorage, not localStorage", () => {
    setPendingFavoriteListingId("listing-1");
    expect(sessionStorage.getItem("pendingFavoriteListingId")).toBe(
      "listing-1",
    );
    expect(localStorage.getItem("pendingFavoriteListingId")).toBeNull();
    expect(localStorage.getItem("favorites")).toBeNull();
  });

  it("consumes the pending listing once", () => {
    setPendingFavoriteListingId("listing-1");
    expect(consumePendingFavoriteListingId()).toBe("listing-1");
    expect(consumePendingFavoriteListingId()).toBeNull();
  });
});
