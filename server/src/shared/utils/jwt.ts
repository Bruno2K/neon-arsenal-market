import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import type { Role } from "../types/roles.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "default-secret-change-me";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "default-refresh-secret";
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: "access" | "refresh";
  jti: string; // Unique token ID — used for blacklisting on logout
}

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

export function signAccessToken(payload: Omit<JwtPayload, "type" | "jti">): string {
  return jwt.sign(
    { ...payload, type: "access" as const, jti: randomUUID() },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES } as jwt.SignOptions
  );
}

export function signRefreshToken(payload: Omit<JwtPayload, "type" | "jti">): string {
  return jwt.sign(
    { ...payload, type: "refresh" as const, jti: randomUUID() },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES } as jwt.SignOptions
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}

/** Calculate absolute expiry date from now + duration string */
export function getRefreshExpiresAt(): Date {
  return new Date(Date.now() + parseDuration(JWT_REFRESH_EXPIRES));
}
