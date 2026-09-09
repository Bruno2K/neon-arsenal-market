import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { resolveClientIp } from "../http/clientIp.js";

const windowMs = 15 * 60 * 1000;

/** Env var wins; else dev=high, prod=strict */
const apiMax =
  process.env.RATE_LIMIT_API_MAX !== undefined && process.env.RATE_LIMIT_API_MAX !== ""
    ? Number(process.env.RATE_LIMIT_API_MAX)
    : process.env.NODE_ENV === "production"
      ? 100
      : 10_000;

const authMax =
  process.env.RATE_LIMIT_AUTH_MAX !== undefined && process.env.RATE_LIMIT_AUTH_MAX !== ""
    ? Number(process.env.RATE_LIMIT_AUTH_MAX)
    : process.env.NODE_ENV === "production"
      ? 10
      : 100;

export function rateLimitClientKey(req: Request): string {
  const clientIp = resolveClientIp(req);
  return clientIp === null ? "unknown-client" : ipKeyGenerator(clientIp, 56);
}

export function createRateLimiter(max: number) {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: rateLimitClientKey,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/** General API: configurable per client via RATE_LIMIT_API_MAX */
export const apiLimiter = createRateLimiter(Number.isNaN(apiMax) ? 10_000 : apiMax);

/** Auth routes (login/register): configurable via RATE_LIMIT_AUTH_MAX */
export const authLimiter = createRateLimiter(Number.isNaN(authMax) ? 100 : authMax);
