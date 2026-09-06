import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReview,
  deleteReview,
  getReview,
  listProductReviews,
  updateReview,
} from "../reviews";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();

vi.mock("../client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

describe("reviews API", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
    get.mockResolvedValue([]);
    post.mockResolvedValue({ id: "rev-1" });
    patch.mockResolvedValue({ id: "rev-1" });
    del.mockResolvedValue({});
  });

  it("lists reviews from GET /reviews/product/:productId", async () => {
    await listProductReviews("ak-redline-ft");
    expect(get).toHaveBeenCalledWith("/reviews/product/ak-redline-ft");
  });

  it("encodes productId in the list path", async () => {
    await listProductReviews("skin/with space");
    expect(get).toHaveBeenCalledWith("/reviews/product/skin%2Fwith%20space");
  });

  it("reads one review from GET /reviews/:id", async () => {
    await getReview("rev-1");
    expect(get).toHaveBeenCalledWith("/reviews/rev-1");
  });

  it("creates a review with POST /reviews", async () => {
    await createReview({
      productId: "prod-1",
      rating: 4,
      comment: "Boa skin",
    });
    expect(post).toHaveBeenCalledWith("/reviews", {
      productId: "prod-1",
      rating: 4,
      comment: "Boa skin",
    });
  });

  it("updates with PATCH /reviews/:id and deletes with DELETE /reviews/:id", async () => {
    await updateReview("rev-1", { rating: 5, comment: "Atualizado" });
    expect(patch).toHaveBeenCalledWith("/reviews/rev-1", {
      rating: 5,
      comment: "Atualizado",
    });
    await deleteReview("rev-1");
    expect(del).toHaveBeenCalledWith("/reviews/rev-1");
  });
});
