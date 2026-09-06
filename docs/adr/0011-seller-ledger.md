# ADR 0011 — SellerTransaction as the financial ledger

## Status

Accepted

## Context

Issue #44. Payment confirmation already inserts a `SellerTransaction` and increments `Seller.balance` in the same PostgreSQL transaction. `(sellerId, orderId)` is unique. Amounts use Prisma `Decimal`. That is necessary but not sufficient: operators and later reconciliation (#45) need an explicit contract for which store is authoritative, how gross/commission/net are computed, which currency and scale apply, and which `PaymentStatus` values a ledger row may have.

The project is a modular monolith. PostgreSQL is the source of truth. Redis, Kafka, SQS, and a finance microservice are not justified. There is no refund or PayPal capture-reversal path (see `docs/architecture/failure-modes.md`).

## Decision

1. **`SellerTransaction` is the authoritative seller ledger.** One row per `(sellerId, orderId)`. Duplicate confirm, webhook replay, and concurrent `confirmPayment` must not insert a second row.
2. **`Seller.balance` is a materialized projection** of `SUM(netAmount)` over that seller's `status = PAID` rows. It is incremented in the **same local database transaction** as the ledger insert. If balance and the ledger ever disagree, **the ledger wins**. Application reads (`commissionsRepository.getBalance`) may use the projection; they must not treat it as independently authoritative.
3. **Identity:** `commission = gross × seller.commissionRate`, `net = gross − commission`. Arithmetic uses Prisma/`Decimal.js`, never JavaScript `number`.
4. **Currency:** ledger amounts are **BRL**, the PayPal `OrdersCreate` currency. `Listing.currency` is catalog metadata (schema default `USD`) and is not the ledger currency. No `currency` column is added; a second currency would be a new product decision.
5. **Scale / rounding:** listing prices and PayPal capture use 2 decimal places (`toFixed(2)` at the PayPal boundary). Commission keeps exact Decimal `gross × rate` (extra fractional digits from the rate are preserved). This is the existing policy; a separate banker's-rounding step is not introduced. The formal catalog (currency, scale, rounding mode, no-refund rule, and shared helpers) is [`docs/architecture/money-policy.md`](../architecture/money-policy.md) and `server/src/shared/money/policy.ts`.
6. **Status:** `SellerTransaction.status` is `PaymentStatus` (`PENDING`, `PAID`, `REFUNDED`). Confirmation writes `PAID`. `PENDING` is the unused column default. `REFUNDED` exists for enum alignment with `Order.paymentStatus`; no application path writes it. Do not invent refunds.
7. **Database enforcement:** keep `@@unique([sellerId, orderId])`. Add CHECK constraints `netAmount = grossAmount - commissionAmount` and non-negative amounts.
8. **Periodic reconciliation (issue #45):** an in-process job (same `setInterval` + `unref` pattern as PayPal GET reconcile / reservation expiry) compares each `Seller.balance` to `SUM(netAmount) WHERE status = 'PAID'`. There is no Render cron, Redis, or extra worker.

## Correction strategy (issue #45)

Safe correction is **projection-only**. Ledger rows are never inserted, updated, or deleted to "fix" a drift.

1. Unlocked scan: load seller projections and grouped PAID SUMs. Compare with Prisma `Decimal.equals` (never JavaScript `number`).
2. For each candidate, open a PostgreSQL transaction, `SELECT … FROM "Seller" WHERE id = $id FOR UPDATE`, re-read `balance` and PAID `SUM(netAmount)`.
3. If they still disagree: `UPDATE Seller SET balance = $sum` (assignment to the ledger figure, not `increment`) and append `AuditLog` `SELLER_BALANCE_RECONCILED` with a system actor (`actorId`/`actorRole` null) in **that same transaction**. `before`/`after` store Decimal strings only.
4. If they agree under the lock: commit with no write. A second sweep is a no-op.
5. Structured `warn` + counters `seller.ledger.drift_detected` / `seller.ledger.corrected` fire only after the transaction commits. Metrics have no sellerId labels.
6. Concurrent `confirmPayment` is safe because it increments `Seller.balance` in the same transaction as the ledger insert; `FOR UPDATE` serializes the corrective SET against that increment so the job cannot apply a stale SUM after a committed credit, and cannot double-credit.

Do not invent refunds, PayPal capture reversal, or a public "fix balance" HTTP route.

## Rollback

Drop the two CHECK constraints. Unique `(sellerId, orderId)` and the confirm-path claim remain from earlier migrations. Documentation and the shared `computeSellerLedgerAmounts` helper can be reverted independently; doing so would not restore a second source of truth. The reconcile job can be removed from `startApiProcess` without changing ledger writes; in-flight sweeps may finish, then projections stop being auto-aligned.

## Consequences

- Duplicate payment confirmation remains a no-op after the order claim (`paymentStatus = PENDING AND status = PENDING`); the unique constraint is defense in depth.
- Demo seed sets `Seller.balance` to `"0.00"` with no `SellerTransaction` rows so the projection matches an empty PAID `SUM(netAmount)`. Re-seed on an existing demo seller writes catalog `"0.00"` only when there are no PAID ledger rows; if PAID rows exist, the projection is set to that SUM so credited net is not wiped. Non-zero production credits are written only by `confirmPayment`. `GET /commissions/balance` returns the Decimal projection without `Number()`. The in-process job periodically realigns a drifted projection to PAID SUM (ledger wins).
- Capture after reservation expiry still creates no ledger row (ADR 0002).
- Multiple API replicas may run the same sweep; extra executions no-op after the first correction.
