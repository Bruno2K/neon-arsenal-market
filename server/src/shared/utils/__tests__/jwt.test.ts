import { describe, it, expect } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  parseDuration,
  assertProductionJwtSecrets,
  FALLBACK_JWT_SECRET,
  FALLBACK_JWT_REFRESH_SECRET,
} from "../jwt.js";

describe("jwt", () => {
  it("signs and verifies access tokens without a family id", () => {
    const token = signAccessToken({ sub: "u1", email: "u@test.com", role: "CUSTOMER" });
    const payload = verifyAccessToken(token);
    expect(payload.type).toBe("access");
    expect(payload.sub).toBe("u1");
    expect(payload.familyId).toBeUndefined();
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("requires jti and familyId on refresh tokens", () => {
    const token = signRefreshToken({
      sub: "u1",
      email: "u@test.com",
      role: "CUSTOMER",
      jti: "jti-1",
      familyId: "fam-1",
    });
    const payload = verifyRefreshToken(token);
    expect(payload).toMatchObject({
      type: "refresh",
      jti: "jti-1",
      familyId: "fam-1",
      sub: "u1",
    });
  });

  it("rejects using a refresh token as access and the reverse", () => {
    const refresh = signRefreshToken({
      sub: "u1",
      email: "u@test.com",
      role: "CUSTOMER",
      jti: "jti-1",
      familyId: "fam-1",
    });
    const access = signAccessToken({ sub: "u1", email: "u@test.com", role: "CUSTOMER" });
    expect(() => verifyAccessToken(refresh)).toThrow();
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it("parses duration strings", () => {
    expect(parseDuration("15m")).toBe(15 * 60 * 1000);
    expect(parseDuration("7d")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("refuses missing or fallback JWT secrets in production", () => {
    expect(() =>
      assertProductionJwtSecrets({ NODE_ENV: "production" })
    ).toThrow(/JWT_SECRET must be set/);
    expect(() =>
      assertProductionJwtSecrets({
        NODE_ENV: "production",
        JWT_SECRET: FALLBACK_JWT_SECRET,
        JWT_REFRESH_SECRET: "real-refresh",
      })
    ).toThrow(/JWT_SECRET must be set/);
    expect(() =>
      assertProductionJwtSecrets({
        NODE_ENV: "production",
        JWT_SECRET: "real-access",
        JWT_REFRESH_SECRET: FALLBACK_JWT_REFRESH_SECRET,
      })
    ).toThrow(/JWT_REFRESH_SECRET must be set/);
  });

  it("does not require secrets outside production and accepts non-default production secrets", () => {
    expect(() => assertProductionJwtSecrets({ NODE_ENV: "test" })).not.toThrow();
    expect(() =>
      assertProductionJwtSecrets({
        NODE_ENV: "production",
        JWT_SECRET: "real-access",
        JWT_REFRESH_SECRET: "real-refresh",
      })
    ).not.toThrow();
  });
});
