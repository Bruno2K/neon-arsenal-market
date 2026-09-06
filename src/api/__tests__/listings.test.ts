import { beforeEach, describe, expect, it, vi } from "vitest";
import { listListings } from "../listings";

const get = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
  },
}));

describe("listListings", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  });

  it("sends server sort whitelist values", async () => {
    await listListings({ sort: "price_asc", status: "ACTIVE" });
    expect(get).toHaveBeenCalledWith("/listings?status=ACTIVE&sort=price_asc");
  });

  it("sends weapon and rarity query params", async () => {
    await listListings({ weapon: "AK-47", rarity: "Covert", status: "ACTIVE" });
    expect(get).toHaveBeenCalledWith(
      "/listings?status=ACTIVE&weapon=AK-47&rarity=Covert",
    );
  });
});
