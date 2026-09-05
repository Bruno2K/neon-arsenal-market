import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentLink } from "../payments";

const post = vi.fn();

vi.mock("../client", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
  },
}));

describe("createPaymentLink", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ approvalUrl: "https://paypal.example/approve" });
  });

  it("posts absolute returnUrl and cancelUrl with the order id", async () => {
    await createPaymentLink({
      orderId: "order-1",
      returnUrl: "https://app.example/orders/order-1/return",
      cancelUrl: "https://app.example/orders/order-1/cancel",
    });

    expect(post).toHaveBeenCalledWith("/payments/create", {
      orderId: "order-1",
      returnUrl: "https://app.example/orders/order-1/return",
      cancelUrl: "https://app.example/orders/order-1/cancel",
    });
  });
});
