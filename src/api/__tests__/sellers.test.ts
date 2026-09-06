import { beforeEach, describe, expect, it, vi } from "vitest";
import { applySeller, listSellers } from "../sellers";

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

  it("GETs /sellers with no query when called without params", async () => {
    await listSellers();
    expect(get).toHaveBeenCalledWith("/sellers");
  });

  it("sends approved=true when requested", async () => {
    await listSellers({ approved: true });
    expect(get).toHaveBeenCalledWith("/sellers?approved=true");
  });
});

describe("applySeller", () => {
  it("POSTs storeName only to /sellers/apply", async () => {
    post.mockResolvedValue({ id: "s1" });
    await applySeller({ storeName: "Loja Nova" });
    expect(post).toHaveBeenCalledWith("/sellers/apply", {
      storeName: "Loja Nova",
    });
  });
});
