import { describe, expect, it } from "vitest";
import { sanitizeAuditIp, sanitizeAuditJson, sanitizeAuditUserAgent } from "../audit.sanitize.js";

describe("audit sanitization", () => {
  it("redacts password, token, and PayPal secret keys", () => {
    const sanitized = sanitizeAuditJson({
      isApproved: true,
      password: "super-secret",
      accessToken: "abc",
      refreshToken: "def",
      client_secret: "paypal-secret",
      nested: { jwt: "header.payload.sig", status: "PAID" },
    });

    expect(sanitized).toEqual({
      isApproved: true,
      password: "[REDACTED]",
      accessToken: "[REDACTED]",
      refreshToken: "[REDACTED]",
      client_secret: "[REDACTED]",
      nested: { jwt: "[REDACTED]", status: "PAID" },
    });
  });

  it("redacts JWT-shaped values even when the key looks safe", () => {
    const sanitized = sanitizeAuditJson({
      note: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30",
      price: "10.00",
    });
    expect(sanitized).toEqual({
      note: "[REDACTED]",
      price: "10.00",
    });
  });

  it("keeps non-sensitive field diffs", () => {
    expect(
      sanitizeAuditJson({
        status: "ACTIVE",
        price: "100.00",
        paymentStatus: "PENDING",
      })
    ).toEqual({
      status: "ACTIVE",
      price: "100.00",
      paymentStatus: "PENDING",
    });
  });

  it("truncates IP and user-agent", () => {
    expect(sanitizeAuditIp("  203.0.113.10  ")).toBe("203.0.113.10");
    expect(sanitizeAuditUserAgent("a".repeat(600))?.length).toBe(512);
    expect(sanitizeAuditIp("")).toBeNull();
  });
});
