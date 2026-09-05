import { describe, expect, it } from "vitest";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  fingerprintOrderCreate,
  parseIdempotencyKeyHeader,
} from "../orders.idempotency.js";

describe("fingerprintOrderCreate", () => {
  it("is independent of listing array order", () => {
    const a = fingerprintOrderCreate({
      items: [{ listingId: "listing-b" }, { listingId: "listing-a" }],
    });
    const b = fingerprintOrderCreate({
      items: [{ listingId: "listing-a" }, { listingId: "listing-b" }],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps duplicate listing IDs distinct from a single ID", () => {
    const singles = fingerprintOrderCreate({ items: [{ listingId: "listing-a" }] });
    const duplicates = fingerprintOrderCreate({
      items: [{ listingId: "listing-a" }, { listingId: "listing-a" }],
    });
    expect(singles).not.toBe(duplicates);
  });
});

describe("parseIdempotencyKeyHeader", () => {
  it("accepts a UUID-shaped key", () => {
    expect(parseIdempotencyKeyHeader("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("rejects a missing header", () => {
    expect(() => parseIdempotencyKeyHeader(undefined)).toThrow(AppError);
    try {
      parseIdempotencyKeyHeader(undefined);
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, message: expect.stringContaining("required") });
    }
  });

  it("rejects an empty or array header", () => {
    expect(() => parseIdempotencyKeyHeader("")).toThrow(AppError);
    expect(() => parseIdempotencyKeyHeader(["key-one-1", "key-two-2"])).toThrow(AppError);
  });

  it("rejects keys that are too short, too long, or contain unsupported characters", () => {
    expect(() => parseIdempotencyKeyHeader("short")).toThrow(AppError);
    expect(() => parseIdempotencyKeyHeader("a".repeat(129))).toThrow(AppError);
    expect(() => parseIdempotencyKeyHeader("bad key!!")).toThrow(AppError);
  });
});
