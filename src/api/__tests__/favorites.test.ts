import { beforeEach, describe, expect, it, vi } from "vitest";
import { addFavorite, listFavorites, removeFavorite } from "../favorites";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

describe("favorites client", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
  });

  it("GETs /favorites and normalizes items", async () => {
    get.mockResolvedValue({
      items: [{ id: "f1", userId: "u1", listingId: "l1" }],
    });
    await expect(listFavorites()).resolves.toEqual([
      { id: "f1", userId: "u1", listingId: "l1" },
    ]);
    expect(get).toHaveBeenCalledWith("/favorites");
  });

  it("POSTs /favorites with listingId", async () => {
    post.mockResolvedValue({ id: "f1", userId: "u1", listingId: "l1" });
    await addFavorite("l1");
    expect(post).toHaveBeenCalledWith("/favorites", { listingId: "l1" });
  });

  it("DELETEs /favorites/:listingId", async () => {
    del.mockResolvedValue(undefined);
    await removeFavorite("l1");
    expect(del).toHaveBeenCalledWith("/favorites/l1");
  });
});
