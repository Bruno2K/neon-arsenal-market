import type { Prisma } from "@prisma/client";

const FORBIDDEN_KEY =
  /password|passwd|secret|token|authorization|cookie|jwt|signature|credential|paypal-transmission-sig|access_token|refresh_token|client_secret/i;

const MAX_IP_LENGTH = 64;
const MAX_USER_AGENT_LENGTH = 512;

export function truncateAuditText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function sanitizeAuditIp(ip: string | null | undefined): string | null {
  return truncateAuditText(ip, MAX_IP_LENGTH);
}

export function sanitizeAuditUserAgent(userAgent: string | null | undefined): string | null {
  return truncateAuditText(userAgent, MAX_USER_AGENT_LENGTH);
}

/**
 * Field-level JSON for before/after. Known secret keys are replaced; values that
 * look like JWTs or PEM material are dropped. Callers should still pass only
 * non-sensitive diffs (status, price, approval flags) — this is defense in depth.
 */
export function sanitizeAuditJson(value: Prisma.InputJsonValue | null | undefined): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return redact(value) as Prisma.InputJsonValue;
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
  if (typeof value === "string" && looksLikeSecretValue(value)) {
    return "[REDACTED]";
  }
  return value;
}

function looksLikeSecretValue(value: string): boolean {
  return /bearer\s+[a-z0-9._-]+/i.test(value) || /^eyj[a-z0-9_-]+\.[a-z0-9_-]+/i.test(value) || /-----begin /i.test(value);
}
