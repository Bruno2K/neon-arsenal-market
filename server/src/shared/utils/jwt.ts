import jwt from "jsonwebtoken";
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
}

export function signAccessToken(payload: Omit<JwtPayload, "type">): string {
  return jwt.sign(
    { ...payload, type: "access" as const },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES } as jwt.SignOptions
  );
}

export function signRefreshToken(payload: Omit<JwtPayload, "type">): string {
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

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}
