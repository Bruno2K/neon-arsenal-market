/** Default timeout for PayPal HTTP calls (create, get, cert download, token). */
export const DEFAULT_PAYPAL_API_TIMEOUT_MS = 10_000;

/** How often the in-process sweep looks up PENDING orders that PayPal may already have captured. */
export const PAYPAL_RECONCILE_INTERVAL_MS = 60_000;

/** Ignore very fresh PENDING orders so we do not race the buyer still on PayPal. */
export const PAYPAL_RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;

export const PAYPAL_RECONCILE_BATCH_SIZE = 20;

/** Refund reconciliation shares the PayPal sweep without adding another timer. */
export const PAYPAL_REFUND_RECONCILE_BATCH_SIZE = 20;

/** New obligations wait briefly for the request path that created them to finish. */
export const PAYPAL_REFUND_PENDING_RETRY_MS = 2 * 60 * 1000;

/** Ambiguous attempts are retried only by a later sweep, never in a busy loop. */
export const PAYPAL_REFUND_PROCESSING_RETRY_MS = 5 * 60 * 1000;

/** Trusted FAILED observations are inspected less often for later provider convergence. */
export const PAYPAL_REFUND_FAILED_RETRY_MS = 30 * 60 * 1000;

/** Unresolved ambiguity older than this emits an operator-intervention signal. */
export const PAYPAL_REFUND_OPERATOR_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Maximum |now − paypal-transmission-time| accepted during signature verification.
 * PayPal documents a 5-minute replay window for webhook timestamps.
 * @see https://developer.paypal.com/api/invoicing/webhooks/#link-validationprocess
 */
export const PAYPAL_WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;

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

/** Lookup/token/cert fetches may retry; mutating PayPal calls must not. */
export const PAYPAL_IDEMPOTENT_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 200,
} as const;
