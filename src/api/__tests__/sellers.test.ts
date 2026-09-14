import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySeller, getSellerById, listSellers } from "../sellers";

const get = vi.fn();
const post = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

describe("listSellers", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue([]);
  });

  // AUD-008 (PR11): public, unauthenticated, always approved-only server-side.
  // There is no client-controlled filter to send anymore.
  it("GETs /sellers with no arguments and no query string", async () => {
    await listSellers();
    expect(get).toHaveBeenCalledWith("/sellers");
  });
});

describe("getSellerById", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({
      id: "seller-1",
      storeName: "Store",
      rating: 0,
      user: null,
    });
  });

  it("GETs /sellers/:id", async () => {
    await getSellerById("seller-1");
    expect(get).toHaveBeenCalledWith("/sellers/seller-1");
  });
});

describe("applySeller", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({});
  });

  it("only sends storeName; no caller-controlled commissionRate (AUD-005)", async () => {
    await applySeller({ storeName: "My Store" });
    expect(post).toHaveBeenCalledWith("/sellers/apply", {
      storeName: "My Store",
    });
  });
});
