/**
 * In-process outbox dispatcher constants.
 * Matching PAYPAL_RECONCILE_INTERVAL_MS: not env vars.
 * Issue #46 / ADR 0012. Do not add Redis, SQS, or a broker.
 */

/** How often the API process claims PENDING outbox rows. */
export const OUTBOX_DISPATCH_INTERVAL_MS = 5_000;

export const OUTBOX_CLAIM_BATCH_SIZE = 20;

/** After this many claims, the row is FAILED. Includes the first attempt. */
export const OUTBOX_MAX_ATTEMPTS = 8;

/** Exponential backoff base: delay = min(base * 2^(attempts-1), max). */
export const OUTBOX_BACKOFF_BASE_MS = 1_000;

export const OUTBOX_BACKOFF_MAX_MS = 5 * 60 * 1000;

/**
 * PROCESSING rows whose claimedAt is older than this are treated as a crash
 * after claim and may be reclaimed with FOR UPDATE SKIP LOCKED.
 */
export const OUTBOX_CLAIM_TIMEOUT_MS = 30_000;

export function outboxBackoffDelayMs(attempts: number): number {
  const safeAttempts = Math.max(1, attempts);
  const delay = OUTBOX_BACKOFF_BASE_MS * 2 ** (safeAttempts - 1);
  return Math.min(delay, OUTBOX_BACKOFF_MAX_MS);
}
