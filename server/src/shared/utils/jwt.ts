import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import type { Role } from "../types/roles.js";

export const FALLBACK_JWT_SECRET = "default-secret-change-me";
export const FALLBACK_JWT_REFRESH_SECRET = "default-refresh-secret";

const JWT_SECRET = process.env.JWT_SECRET ?? FALLBACK_JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? FALLBACK_JWT_REFRESH_SECRET;
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

/** Fail closed in production instead of signing tokens with compiled fallbacks. */
export function assertProductionJwtSecrets(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.NODE_ENV !== "production") return;
  if (!env.JWT_SECRET || env.JWT_SECRET === FALLBACK_JWT_SECRET) {
    throw new Error("JWT_SECRET must be set to a non-default value when NODE_ENV=production");
  }
  if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET === FALLBACK_JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET must be set to a non-default value when NODE_ENV=production");
  }
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: "access" | "refresh";
  jti: string;
  /** Refresh-token family. Present only on refresh tokens. */
  familyId?: string;
}

export type RefreshJwtPayload = JwtPayload & { type: "refresh"; familyId: string };

/** Parse a duration string like "7d", "15m", "1h" to milliseconds */
export function parseDuration(s: string): number {
  const match = s.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "ms": return n;
    case "s":  return n * 1000;
    case "m":  return n * 60 * 1000;
    case "h":  return n * 60 * 60 * 1000;
    case "d":  return n * 24 * 60 * 60 * 1000;
    default:   return n * 1000;
  }
}

export function signAccessToken(payload: Omit<JwtPayload, "type" | "jti" | "familyId">): string {
  return jwt.sign(
    { ...payload, type: "access" as const, jti: randomUUID() },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES } as jwt.SignOptions
  );
}

export function signRefreshToken(
  payload: Omit<JwtPayload, "type"> & { jti: string; familyId: string }
): string {
  return jwt.sign(
    { ...payload, type: "refresh" as const },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES } as jwt.SignOptions
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshJwtPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  if (!decoded.jti || !decoded.familyId) throw new Error("Invalid refresh token claims");
  return decoded as RefreshJwtPayload;
}

/** Calculate absolute expiry date from now + duration string */
export function getRefreshExpiresAt(): Date {
  return new Date(Date.now() + parseDuration(JWT_REFRESH_EXPIRES));
}
