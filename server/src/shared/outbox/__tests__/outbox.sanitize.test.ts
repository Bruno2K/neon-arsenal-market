import { describe, it, expect } from "vitest";
import { sanitizeOutboxError, sanitizeOutboxPayload } from "../outbox.sanitize.js";

describe("sanitizeOutboxPayload", () => {
  it("keeps non-secret order confirmation fields", () => {
    expect(
      sanitizeOutboxPayload({ orderId: "order-1", paymentStatus: "PAID", status: "CONFIRMED" })
    ).toEqual({ orderId: "order-1", paymentStatus: "PAID", status: "CONFIRMED" });
  });

  it("redacts known secret keys and JWT-shaped values", () => {
    expect(
      sanitizeOutboxPayload({
        orderId: "order-1",
        access_token: "secret-value",
        note: "eyJhbGciOiJIUzI1NiJ9.payload",
      })
    ).toEqual({
      orderId: "order-1",
      access_token: "[REDACTED]",
      note: "[REDACTED]",
    });
  });
});

describe("sanitizeOutboxError", () => {
  it("truncates long messages and redacts bearer tokens", () => {
    expect(sanitizeOutboxError(new Error("Bearer abcdefghijklmnop"))).toBe("[REDACTED]");
    expect(sanitizeOutboxError(new Error("x".repeat(600))).length).toBe(512);
  });
});
