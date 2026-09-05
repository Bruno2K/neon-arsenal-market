import type { Attributes, AttributeValue } from "@opentelemetry/api";

const FORBIDDEN_KEY = /password|passwd|secret|token|authorization|cookie|jwt|signature|credential|paypal-transmission-sig|access_token/i;

const FORBIDDEN_VALUE = /bearer\s+[a-z0-9._-]+|eyj[a-z0-9_-]+\.[a-z0-9_-]+|-----begin /i;

export function isForbiddenAttributeKey(key: string) {
  return FORBIDDEN_KEY.test(key);
}

export function sanitizeAttributeValue(value: AttributeValue): AttributeValue | undefined {
  if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
    return undefined;
  }
  return value;
}

export function safeAttributes(input: Record<string, AttributeValue | undefined> = {}): Attributes {
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || isForbiddenAttributeKey(key)) continue;
    const sanitized = sanitizeAttributeValue(value);
    if (sanitized === undefined) continue;
    attributes[key] = sanitized;
  }
  return attributes;
}

export function containsSensitiveTelemetry(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") {
    return FORBIDDEN_KEY.test(value) || FORBIDDEN_VALUE.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsSensitiveTelemetry);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => isForbiddenAttributeKey(key) || containsSensitiveTelemetry(nested)
    );
  }
  return false;
}
