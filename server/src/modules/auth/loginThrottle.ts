/**
 * Progressive delay after consecutive failed logins for one normalized email.
 *
 * The HTTP handler does not sleep (that would pin a worker). The delay is
 * enforced by storing `nextAllowedAt` and returning HTTP 429 + Retry-After.
 *
 * Failures 1–2: no wait. From the 3rd failure: 1s, 2s, 4s, … capped at 15 minutes.
 * A quiet window of 15 minutes resets the counter.
 *
 * Constants live in code (no new env vars).
 */
export const LOGIN_THROTTLE = {
  freeFailures: 2,
  baseDelayMs: 1_000,
  maxDelayMs: 15 * 60 * 1_000,
  resetAfterMs: 15 * 60 * 1_000,
} as const;

export function normalizeLoginEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Delay applied *after* `failedCount` consecutive failures (the just-recorded count). */
export function delayAfterFailuresMs(failedCount: number): number {
  if (failedCount <= LOGIN_THROTTLE.freeFailures) return 0;
  const exp = failedCount - LOGIN_THROTTLE.freeFailures - 1;
  const ms = LOGIN_THROTTLE.baseDelayMs * 2 ** Math.max(0, exp);
  return Math.min(LOGIN_THROTTLE.maxDelayMs, ms);
}

export function nextAllowedAtAfterFailure(failedCount: number, now: Date): Date | null {
  const delay = delayAfterFailuresMs(failedCount);
  if (delay <= 0) return null;
  return new Date(now.getTime() + delay);
}

export function retryAfterSeconds(nextAllowedAt: Date, now: Date): number {
  return Math.max(1, Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 1000));
}

export function shouldResetThrottleWindow(lastFailedAt: Date, now: Date): boolean {
  return now.getTime() - lastFailedAt.getTime() >= LOGIN_THROTTLE.resetAfterMs;
}
