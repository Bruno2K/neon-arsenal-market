import type { Request } from "express";
import { AppError } from "../errors/AppError.js";

/**
 * Express 5 exposes `query` / `params` as getter-only properties.
 * Zod middleware still needs to install the parsed (coerced) object.
 */
export function replaceRequestField(req: Request, field: "query" | "params", value: object): void {
  Object.defineProperty(req, field, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

/** Express 5 types path params as `string | string[]`. Routes use a single segment. */
export function requestParam(req: Request, name: string): string {
  const raw = req.params[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError(400, `Invalid ${name}`);
  }
  return value;
}
