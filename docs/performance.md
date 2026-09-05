# Performance evidence

Measured on PostgreSQL 16, local Cloud Agent VM, 2 500 `ACTIVE` listings, 80 `RESERVED`, 80 `SOLD`, 120 stale pending PayPal orders. Command: `cd server && npm run perf:evidence` (after `prisma migrate deploy`). CI re-checks index use in `performance.evidence.integration.test.ts`.

This is not a production load test. Absolute milliseconds will move with hardware. The **shape** of the plans and the chosen mitigations are the durable result.

## Hot paths

| Path | What actually runs | Dominant cost today |
|---|---|---|
| `GET /listings?status=ACTIVE` | `Listing` page `ORDER BY createdAt DESC LIMIT 20` plus `COUNT(*)` and joins to Product/Seller/User | `COUNT(*)` + joins, not the page index scan |
| `GET /listings/:id` | PK lookup + joins | Primary key |
| `POST /orders` | Transaction: unique idempotency insert, per-listing conditional `UPDATE` by PK, order items | Row lock on the listing, not a scan |
| `confirmPayment` | Conditional order claim by PK, conditional listing sell, seller transactions | Same: PK/conditional updates |
| Reservation expiry sweep | `UPDATE Listing WHERE status = 'RESERVED' AND (expires <= now OR expires IS NULL)` then unpaid-order `EXISTS` | Tiny `RESERVED` set |
| PayPal reconciliation | `PENDING` orders with `paypalOrderId`, oldest first, batch 20 | Composite index + PayPal GET |

PayPal HTTP (`PAYPAL_API_TIMEOUT_MS` = 10s) dominates `POST /payments` latency. Database work on that path is a PK update of `paypalOrderId`.

The market UI sorts price/float **in the browser on the current page**. SQL still orders by `createdAt`. A `(status, price)` index would be unused until the API accepts a sort field.

## EXPLAIN ANALYZE (representative)

| Query | Plan | Execution |
|---|---|---|
| Market page (`status = ACTIVE ORDER BY createdAt DESC LIMIT 20`) | Index Scan `Listing_status_createdAt_idx` | 0.017 ms |
| Market `COUNT(*)` where `status = ACTIVE` | Seq Scan | 0.425 ms |
| Market page plus price range | Index Scan `Listing_status_createdAt_idx` (filter on price) | 0.018 ms |
| Expiry predicate including `OR expires IS NULL` | Index Scan `Listing_status_createdAt_idx` (status prefix) | 0.030 ms |
| Expiry predicate `status = RESERVED AND expires <= now()` | `Listing_status_reservationExpiresAt_idx` | proven in CI |
| Reconciliation pending PayPal orders | Index Scan `Order_paymentStatus_status_updatedAt_idx` | 0.034 ms |
| Unpaid orders that no longer hold listings | Nested loop on `OrderItem` / `Listing_pkey` | 0.023 ms |

`listingsService.list` (page + count + joins), 10 samples: p50 **2.59 ms**, p95 **4.27 ms**.

Index-only/unique lookups for `OrderIdempotencyKey(customerId, key)` and `PaymentWebhookEvent(provider, externalEventId)` are constraints first. At one row the planner may seq-scan; uniqueness still serializes concurrent retries.

## Index review

| Index | Decision | Why |
|---|---|---|
| `Listing(status, createdAt)` | **Added** (replaces `Listing(status)`) | Real market SQL |
| `Order(paymentStatus, status, updatedAt)` | **Added** (replaces `Order(paymentStatus)`) | Reconciliation SQL |
| `Listing(status, reservationExpiresAt)` | Keep | Expiry without the NULL branch |
| `Listing(productId, status)`, `sellerId`, `price`, `floatValue` | Keep | Filters / FKs |
| `Listing(status, price)` | **Not added** | API does not `ORDER BY price` |
| Unique `(customerId, key)`, `(provider, externalEventId)`, `paypalOrderId` | Keep | Correctness, not speed |

## Bottleneck and mitigation

**Chosen now:** composite indexes above. No Redis, no query cache, no queue.

**Measured bottleneck on the read path:** `COUNT(*)` for pagination `total`, not the `LIMIT 20` index scan. At 2.5k rows it is still sub-millisecond. Do not cache it yet.

**Not a database problem:** PayPal round-trips; checkout correctness under contention (conditional `UPDATE`).

## Capacity assumptions

- One modular-monolith API process + one PostgreSQL. In-process expiry/reconciliation timers. Horizontal API replicas are safe because invariants live in PostgreSQL.
- Current catalog size (demo seed / a few thousand listings) is well inside the plans above.
- OFFSET pagination is used (`page * limit`). Deep offsets are not a current product need (`limit` max 100).

## Scaling triggers

See `docs/architecture/scaling-path.md`. Repeat measurements with `npm run perf:evidence` after the catalog grows by an order of magnitude, or if `GET /listings` p95 exceeds ~50 ms in a production-like environment.
