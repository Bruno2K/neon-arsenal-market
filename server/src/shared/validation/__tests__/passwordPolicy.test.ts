import { describe, it, expect } from "vitest";
import { passwordSchema, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "../passwordPolicy.js";

describe("passwordSchema", () => {
  it("accepts demo-quality passwords", () => {
    expect(passwordSchema.parse("admin123")).toBe("admin123");
    expect(passwordSchema.parse("buyer123")).toBe("buyer123");
  });

  it("rejects short, letter-only, digit-only, and overlong secrets", () => {
    expect(() => passwordSchema.parse("abc123")).toThrow();
    expect(() => passwordSchema.parse("password")).toThrow();
    expect(() => passwordSchema.parse("12345678")).toThrow();
    expect(() => passwordSchema.parse("a".repeat(PASSWORD_MAX_LENGTH + 1))).toThrow();
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});
