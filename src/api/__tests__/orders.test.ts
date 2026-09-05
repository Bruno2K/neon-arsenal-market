import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder } from "../orders";

const post = vi.fn();

vi.mock("../client", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
  },
}));

describe("createOrder", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ id: "order-1" });
  });

  it("sends Idempotency-Key on POST /orders", async () => {
    await createOrder(
      { items: [{ listingId: "listing-ak" }] },
      { idempotencyKey: "11111111-1111-4111-8111-111111111111" },
    );

    expect(post).toHaveBeenCalledWith(
      "/orders",
      { items: [{ listingId: "listing-ak" }] },
      {
        headers: {
          "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
        },
      },
    );
  });
});
