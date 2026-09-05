import { describe, expect, it } from "vitest";
import { paypalCheckoutUrls } from "../paypalCheckoutUrls";

describe("paypalCheckoutUrls", () => {
  it("builds absolute http return and cancel URLs", () => {
    const urls = paypalCheckoutUrls(
      "order-1",
      "https://market.neonarsenal.example",
    );

    expect(urls.returnUrl).toBe(
      "https://market.neonarsenal.example/orders/order-1/return",
    );
    expect(urls.cancelUrl).toBe(
      "https://market.neonarsenal.example/orders/order-1/cancel",
    );
    expect(() => new URL(urls.returnUrl)).not.toThrow();
    expect(() => new URL(urls.cancelUrl)).not.toThrow();
  });

  it("encodes the order id in the path", () => {
    const urls = paypalCheckoutUrls("ord/../x", "https://app.example");
    expect(urls.returnUrl).toBe(
      "https://app.example/orders/ord%2F..%2Fx/return",
    );
    expect(urls.cancelUrl).toBe(
      "https://app.example/orders/ord%2F..%2Fx/cancel",
    );
  });

  it("rejects a non-http origin", () => {
    expect(() => paypalCheckoutUrls("order-1", "ftp://files.example")).toThrow(
      /absolute http\(s\)/i,
    );
  });
});
