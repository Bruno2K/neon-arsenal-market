/** Default timeout for PayPal HTTP calls (create, get, cert download, token). */
export const DEFAULT_PAYPAL_API_TIMEOUT_MS = 10_000;

/** How often the in-process sweep looks up PENDING orders that PayPal may already have captured. */
export const PAYPAL_RECONCILE_INTERVAL_MS = 60_000;

/** Ignore very fresh PENDING orders so we do not race the buyer still on PayPal. */
export const PAYPAL_RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;

export const PAYPAL_RECONCILE_BATCH_SIZE = 20;

export function getPayPalApiTimeoutMs(): number {
  const raw = process.env.PAYPAL_API_TIMEOUT_MS;
  if (raw === undefined || raw === "") return DEFAULT_PAYPAL_API_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAYPAL_API_TIMEOUT_MS;
  return parsed;
}

export function getPayPalApiBaseUrl(): string {
  return process.env.PAYPAL_MODE === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}
