import rateLimit from "express-rate-limit";

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

/** General API: configurable per IP via RATE_LIMIT_API_MAX */
export const apiLimiter = rateLimit({
  windowMs,
  max: Number.isNaN(apiMax) ? 10_000 : apiMax,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Auth routes (login/register): configurable via RATE_LIMIT_AUTH_MAX */
export const authLimiter = rateLimit({
  windowMs,
  max: Number.isNaN(authMax) ? 100 : authMax,
  standardHeaders: true,
  legacyHeaders: false,
});
