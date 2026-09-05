/** Default checkout reservation window. Overridden by RESERVATION_TTL_MINUTES when set. */
const DEFAULT_TTL_MINUTES = 15;

/** How often the in-process sweep looks for expired reservations. */
export const RESERVATION_EXPIRY_SWEEP_INTERVAL_MS = 30_000;

export function getReservationTtlMinutes(): number {
  const raw = process.env.RESERVATION_TTL_MINUTES;
  if (raw === undefined || raw === "") return DEFAULT_TTL_MINUTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_MINUTES;
  return parsed;
}

export function getReservationTtlMs(): number {
  return getReservationTtlMinutes() * 60 * 1000;
}

export function buildReservationWindow(now = new Date()) {
  return {
    reservedAt: now,
    reservationExpiresAt: new Date(now.getTime() + getReservationTtlMs()),
  };
}
