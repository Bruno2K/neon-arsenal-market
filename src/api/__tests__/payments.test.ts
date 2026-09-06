import { beforeEach, describe, expect, it, vi } from "vitest";
import { capturePayment, createPaymentLink } from "../payments";

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

describe("capturePayment", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ orderId: "order-1", paymentStatus: "PAID" });
  });

  it("posts the order id to /payments/capture", async () => {
    await capturePayment({ orderId: "order-1" });
    expect(post).toHaveBeenCalledWith("/payments/capture", {
      orderId: "order-1",
    });
  });
});
