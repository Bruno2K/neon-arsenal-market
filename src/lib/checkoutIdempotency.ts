/** Max length accepted by `POST /orders` `Idempotency-Key`. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export type CheckoutIdempotencyState = {
  fingerprint: string;
  key: string;
};

export function listingSetFingerprint(listingIds: string[]): string {
  return [...new Set(listingIds)].sort().join(",");
}

export function createCheckoutIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Stable key for one checkout attempt. Reuses the previous UUID while the
 * listing id set is unchanged; a different set starts a new attempt.
 */
export function resolveCheckoutIdempotencyKey(
  current: CheckoutIdempotencyState | null,
  listingIds: string[],
  createKey: () => string = createCheckoutIdempotencyKey,
): CheckoutIdempotencyState {
  const fingerprint = listingSetFingerprint(listingIds);
  if (current?.fingerprint === fingerprint && current.key) {
    return current;
  }
  const key = createKey();
  if (!key || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new Error("Idempotency-Key must be 1–128 characters");
  }
  return { fingerprint, key };
}
