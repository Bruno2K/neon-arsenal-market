import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateOrderInput } from "./orders.dto.js";

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export const idempotencyKeySchema = z
  .string()
  .min(IDEMPOTENCY_KEY_MIN_LENGTH)
  .max(IDEMPOTENCY_KEY_MAX_LENGTH)
  .regex(/^[A-Za-z0-9._:-]+$/, "Idempotency-Key contains unsupported characters");

/**
 * Canonical fingerprint of POST /orders input after Zod parsing.
 * Listing IDs are sorted so JSON property/array order cannot false-mismatch
 * a retry. Duplicate IDs are kept so [A,A] does not fingerprint as [A].
 */
export function fingerprintOrderCreate(input: CreateOrderInput): string {
  const listingIds = input.items.map((item) => item.listingId).slice().sort();
  return createHash("sha256").update(JSON.stringify({ listingIds })).digest("hex");
}

export function parseIdempotencyKeyHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value) || value === undefined || value.trim() === "") {
    throw new AppError(400, "Idempotency-Key header is required");
  }
  const parsed = idempotencyKeySchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      400,
      "Idempotency-Key must be 8-128 characters of A-Z, a-z, 0-9, '.', '_', ':' or '-'"
    );
  }
  return parsed.data;
}
