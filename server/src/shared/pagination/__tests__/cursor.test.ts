import { describe, expect, it } from "vitest";
import { AppError } from "../../errors/AppError.js";
import {
  CURSOR_MAX_LENGTH,
  createdAtIdKeysetWhere,
  decodeCreatedAtIdCursor,
  encodeCreatedAtIdCursor,
  nextCreatedAtIdCursor,
} from "../cursor.js";

describe("createdAt+id cursor", () => {
  const keys = {
    createdAt: new Date("2026-06-01T12:34:56.789Z"),
    id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
  };

  it("round-trips createdAt and id", () => {
    const encoded = encodeCreatedAtIdCursor(keys);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(decodeCreatedAtIdCursor(encoded)).toEqual(keys);
  });

  it("rejects malformed, extra-key, and non-ISO payloads with 400", () => {
    const invalid = [
      "",
      "not-base64",
      Buffer.from("[]", "utf8").toString("base64url"),
      Buffer.from("null", "utf8").toString("base64url"),
      Buffer.from(JSON.stringify({ t: keys.createdAt.toISOString() }), "utf8").toString("base64url"),
      Buffer.from(JSON.stringify({ t: keys.createdAt.toISOString(), i: keys.id, extra: 1 }), "utf8").toString(
        "base64url"
      ),
      Buffer.from(JSON.stringify({ t: "yesterday", i: keys.id }), "utf8").toString("base64url"),
      Buffer.from(JSON.stringify({ t: keys.createdAt.toISOString(), i: "" }), "utf8").toString("base64url"),
      "a".repeat(CURSOR_MAX_LENGTH + 1),
    ];

    for (const raw of invalid) {
      expect(() => decodeCreatedAtIdCursor(raw), raw.slice(0, 40)).toThrow(AppError);
      try {
        decodeCreatedAtIdCursor(raw);
      } catch (error) {
        expect(error).toMatchObject({ statusCode: 400, message: "Invalid cursor" });
      }
    }
  });

  it("builds a DESC keyset predicate and encodes nextCursor only when a page continues", () => {
    const where = createdAtIdKeysetWhere(keys);
    expect(where.OR[0]).toEqual({ createdAt: { lt: keys.createdAt } });
    expect(where.OR[1]).toEqual({
      AND: [{ createdAt: keys.createdAt }, { id: { lt: keys.id } }],
    });

    expect(nextCreatedAtIdCursor([keys], false)).toBeNull();
    expect(nextCreatedAtIdCursor([], true)).toBeNull();
    expect(nextCreatedAtIdCursor([keys], true)).toBe(encodeCreatedAtIdCursor(keys));
  });
});
