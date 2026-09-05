import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSellers } from "../sellers";

const get = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
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
