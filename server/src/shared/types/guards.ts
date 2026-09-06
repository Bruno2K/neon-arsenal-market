/**
 * Narrowing helpers for untrusted values (HTTP, PayPal JSON, JWT claims).
 * Prefer these over `as` when a wrong label would hide a domain invariant.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.some((item) => item === value);
}
