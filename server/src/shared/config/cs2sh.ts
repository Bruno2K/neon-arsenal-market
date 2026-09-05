/**
 * cs2.sh catalog client. Snapshots are large (~47k schema items + full prices),
 * so the timeout is higher than PayPal's 10s. GETs may retry (ADR 0005).
 * There is no mutating cs2.sh call in this codebase.
 */
export const DEFAULT_CS2SH_API_BASE_URL = "https://api.cs2.sh";
export const DEFAULT_CS2SH_API_TIMEOUT_MS = 60_000;
export const DEFAULT_CS2SH_DEMO_LISTING_COUNT = 24;
export const MAX_CS2SH_DEMO_LISTING_COUNT = 100;
export const CS2SH_CATALOG_UPSERT_CHUNK_SIZE = 500;

export const CS2SH_IDEMPOTENT_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 200,
} as const;

export function getCs2ShApiKey(): string {
  return process.env.CS2SH_API_KEY?.trim() ?? "";
}

export function getCs2ShApiBaseUrl(): string {
  const raw = process.env.CS2SH_API_BASE_URL?.trim();
  if (!raw) return DEFAULT_CS2SH_API_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function getCs2ShApiTimeoutMs(): number {
  const raw = process.env.CS2SH_API_TIMEOUT_MS;
  if (raw === undefined || raw === "") return DEFAULT_CS2SH_API_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CS2SH_API_TIMEOUT_MS;
  return parsed;
}

export function isCs2ShConfigured(): boolean {
  return getCs2ShApiKey() !== "";
}

/** Boot-time import. Opt-in; the API stays up if the key is missing. */
export function isCs2ShImportEnabled(): boolean {
  return process.env.CS2SH_IMPORT === "true";
}

export function getCs2ShDemoListingCount(): number {
  const raw = process.env.CS2SH_DEMO_LISTING_COUNT;
  if (raw === undefined || raw === "") return DEFAULT_CS2SH_DEMO_LISTING_COUNT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_CS2SH_DEMO_LISTING_COUNT;
  return Math.min(parsed, MAX_CS2SH_DEMO_LISTING_COUNT);
}
