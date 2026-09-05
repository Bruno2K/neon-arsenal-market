import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder, getOrder } from "../orders";

const post = vi.fn();
const get = vi.fn();

vi.mock("../client", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
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

describe("getOrder", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ id: "order-1", paymentStatus: "PENDING" });
  });

  it("GETs /orders/:id without inventing a paid state", async () => {
    await getOrder("order-1");
    expect(get).toHaveBeenCalledWith("/orders/order-1");
  });
});
