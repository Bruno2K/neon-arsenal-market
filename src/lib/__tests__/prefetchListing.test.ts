import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  prefetchListingDetail,
  resetListingPrefetchForTests,
} from "../prefetchListing";

const getListing = vi.fn();

vi.mock("@/api/listings", () => ({
  getListing: (...args: unknown[]) => getListing(...args),
}));

describe("prefetchListingDetail", () => {
  beforeEach(() => {
    getListing.mockReset();
    getListing.mockResolvedValue({ id: "listing-1" });
    resetListingPrefetchForTests();
  });

  it("issues at most one GET per listing per interval", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    prefetchListingDetail(client, "listing-1");
    prefetchListingDetail(client, "listing-1");
    expect(getListing).toHaveBeenCalledTimes(1);
    expect(getListing).toHaveBeenCalledWith("listing-1");
  });
});
