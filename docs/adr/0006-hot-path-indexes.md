# ADR 0006 — Hot-path indexes from measured query plans

## Status

Accepted

## Context

Issue #9 / roadmap P1.4 requires index decisions backed by `EXPLAIN ANALYZE`, not by adding caches. The public market calls `GET /listings?status=ACTIVE` and the API orders by `createdAt DESC` (the client re-sorts the current page by price/float). PayPal reconciliation lists stale `PENDING` orders by `updatedAt`.

Existing single-column `Listing(status)` and `Order(paymentStatus)` indexes do not cover those `ORDER BY` clauses.

## Decision

1. Replace `Listing_status_idx` with `Listing(status, createdAt)`. Left-prefix still serves status-only filters; the extra column avoids a sort for market pagination.
2. Replace `Order_paymentStatus_idx` with `Order(paymentStatus, status, updatedAt)` for the reconciliation batch (`PENDING`/`PENDING`, `paypalOrderId IS NOT NULL`, oldest first).
3. Keep `Listing(status, reservationExpiresAt)` and unique keys for idempotency and webhook events. Do not add `(status, price)` until the API sorts by price.
4. Do not introduce Redis, a cache, or a queue. At 2.5k listings the page query is ~0.02ms; `COUNT(*)` is the slower sibling (~0.4ms) and remains acceptable.

## Consequences

- Market `LIMIT 20` uses `Listing_status_createdAt_id_idx` (issue #49 extended the tie-breaker; see Later change).
- Reconciliation uses `Order_paymentStatus_status_updatedAt_idx` (measured).
- `COUNT(*)` for `total` may still seq-scan in offset mode. Cursor pagination (issue #49 / ADR 0013) skips that count.
- Expiry `OR reservationExpiresAt IS NULL` may not pick the reservation-expiry index; reserved cardinality is small. Split that predicate only if expiry scans become a measured problem.

## Later change (issue #49)

`GET /listings` now orders by `createdAt DESC, id DESC`. `Listing(status, createdAt)` was replaced by `Listing(status, createdAt, id)` so the market keyset uses the same index. `Listing(createdAt, id)` covers unfiltered lists. See ADR 0013.

## Later change (issue #93)

Offset `GET /listings` accepts `sort=price_asc|price_desc|float_asc|float_desc` in addition to default `createdAt_desc`. `Listing(status, price, id)` and `Listing(status, floatValue, id)` cover those orderings. Cursor mode is unchanged.
