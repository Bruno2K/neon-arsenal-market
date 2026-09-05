# ADR 0001 — In-process reservation expiry

## Status

Accepted

## Context

Listings are unique items. A checkout hold (`RESERVED`) must expire back to `ACTIVE` without reactivating a listing that payment confirmation has already marked `SOLD`. The project is a modular monolith: PostgreSQL is the source of truth for transactional state. No queue, scheduler product, or extra runtime has been justified.

## Decision

1. Persist `reservedAt` and `reservationExpiresAt` on the same atomic `ACTIVE → RESERVED` update used at order creation.
2. TTL is `RESERVATION_TTL_MINUTES` (documented in `server/.env.example`), default 15 minutes.
3. Release expired rows with a conditional `UPDATE ... WHERE status = 'RESERVED' AND reservationExpiresAt <= now()`. That predicate cannot match `SOLD`.
4. Payment confirmation sells listings with `status = 'RESERVED' AND reservationExpiresAt > now()`. If the sold row count does not match the order items, the transaction throws and the order payment claim rolls back.
5. Run the expire `UPDATE` from an in-process interval started in `server/src/index.ts`. Overlapping instances are safe because the database predicate is the lock.

Payment confirmation locks the order row first, then listings. The expiry sweep updates listings first and cancels unpaid orders in a separate statement, so the two workflows do not take those locks in opposite order.

## Consequences

- Maximum extra hold after TTL is bounded by the sweep interval (30 seconds), but payment is refused immediately when `reservationExpiresAt` is in the past even if the sweep has not run.
- Multiple API replicas may run the same sweep; extra executions are no-ops.
- A crash between listing release and order cancel is recovered on the next sweep: unpaid `PENDING` orders whose items are no longer `RESERVED` are cancelled.
- An external cron or queue is unnecessary until there is evidence that process-local timers are operationally insufficient (for example, expiry delayed by a frozen event loop across all replicas).
