import { describe, expect, it } from "vitest";
import { PAYPAL_HTTP_POLICY } from "../paypal.js";

describe("PayPal HTTP retry policy", () => {
  it("never retries mutating PayPal operations", () => {
    expect(PAYPAL_HTTP_POLICY.orders_create.retry).toBe(false);
    expect(PAYPAL_HTTP_POLICY.orders_capture.retry).toBe(false);
  });

  it("retries idempotent lookups with a bounded attempt count", () => {
    expect(PAYPAL_HTTP_POLICY.orders_get).toMatchObject({ retry: true, maxAttempts: 3 });
    expect(PAYPAL_HTTP_POLICY.oauth_token).toMatchObject({ retry: true, maxAttempts: 3 });
    expect(PAYPAL_HTTP_POLICY.cert_download).toMatchObject({ retry: true, maxAttempts: 3 });
  });
});
