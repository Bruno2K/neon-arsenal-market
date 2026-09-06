import type { NextFunction, Request, Response } from "express";

export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-DNS-Prefetch-Control": "off",
} as const;

export const HSTS_HEADER = "max-age=15552000; includeSubDomains";

/**
 * Browser-abuse headers for a JSON API.
 * Cross-Origin-Resource-Policy is omitted so CORS-allowed frontends can read responses.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", HSTS_HEADER);
  }
  next();
}
