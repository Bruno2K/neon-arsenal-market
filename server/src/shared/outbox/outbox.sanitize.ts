import type { Prisma } from "@prisma/client";

const FORBIDDEN_KEY =
  /password|passwd|secret|token|authorization|cookie|jwt|signature|credential|paypal-transmission-sig|access_token|refresh_token|client_secret/i;

const FORBIDDEN_VALUE = /bearer\s+[a-z0-9._-]+|eyj[a-z0-9_-]+\.[a-z0-9._-]+|-----begin /i;

const MAX_ERROR_LENGTH = 512;

/**
 * Defense in depth: outbox payload must be non-secret JSON (ids, statuses).
 * Known secret keys and JWT/PEM-shaped values are redacted if a caller slips.
 */
export function sanitizeOutboxPayload(
  value: Prisma.InputJsonValue
): Prisma.InputJsonValue {
  return redact(value) as Prisma.InputJsonValue;
}

export function sanitizeOutboxError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const redacted = FORBIDDEN_VALUE.test(message) ? "[REDACTED]" : message;
  return redacted.length > MAX_ERROR_LENGTH ? redacted.slice(0, MAX_ERROR_LENGTH) : redacted;
}

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY.test(key)) {
        out[key] = "[REDACTED]";
        continue;
      }
      out[key] = redact(nested);
    }
    return out;
  }
  if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
    return "[REDACTED]";
  }
  return value;
}
