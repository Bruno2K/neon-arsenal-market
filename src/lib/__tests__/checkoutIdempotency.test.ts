import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  resolveCheckoutIdempotencyKey,
} from "../checkoutIdempotency";

describe("resolveCheckoutIdempotencyKey", () => {
  it("reuses the key while the listing set is unchanged", () => {
    const first = resolveCheckoutIdempotencyKey(
      null,
      ["b", "a"],
      () => "key-1",
    );
    const second = resolveCheckoutIdempotencyKey(
      first,
      ["a", "b"],
      () => "key-2",
    );

    expect(first.key).toBe("key-1");
    expect(second.key).toBe("key-1");
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it("issues a new key when the listing set changes", () => {
    const first = resolveCheckoutIdempotencyKey(null, ["a"], () => "key-1");
    const second = resolveCheckoutIdempotencyKey(
      first,
      ["a", "c"],
      () => "key-2",
    );

    expect(second.key).toBe("key-2");
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it("rejects keys longer than the API maximum", () => {
    expect(() =>
      resolveCheckoutIdempotencyKey(null, ["a"], () =>
        "k".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1),
      ),
    ).toThrow(/1–128/);
  });
});
