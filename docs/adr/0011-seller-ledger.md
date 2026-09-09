# ADR 0011 — SellerTransaction as the financial ledger

## Status

Accepted

Currency wording amended by [ADR 0022](./0022-single-checkout-currency.md):
`Listing.price` and `Listing.currency` are BRL checkout data, not unrelated
catalog metadata.

Ledger cardinality and compensation semantics amended by
[ADR 0023](./0023-refund-compensation.md): history is append-only and one
seller/order may contain a payment credit plus a distinct refund compensation.

## Context

Issue #44 established payment confirmation as a `SellerTransaction` insert plus an atomic `Seller.balance` update. TASK-0013 evolves the original one-row-per-seller/order model so the same order can retain its credit and append a distinct compensation. Amounts remain Prisma `Decimal`.

The project remains a modular monolith with PostgreSQL as source of truth. Redis, Kafka, SQS, and a finance microservice are not justified. TASK-0013 adds local refund persistence only; PayPal refund execution remains for TASK-0014.

## Decision

1. **`SellerTransaction` is the authoritative append-only seller ledger.** `PAYMENT_CREDIT` and `REFUND_COMPENSATION` are distinct economic movements. The original credit remains visible after compensation.
2. **`Seller.balance` is a materialized projection** of `SUM(netAmount)` over that seller's `status = PAID` movements. Credits are positive and compensations are exact signed inverses. Insertion and projection increment happen in the **same local PostgreSQL transaction**. If balance and ledger disagree, **the ledger wins**.
3. **Identity:** `commission = gross × seller.commissionRate`, `net = gross − commission`. Arithmetic uses Prisma/`Decimal.js`, never JavaScript `number`.
4. **Currency:** ledger amounts, `Listing.price`, `Listing.currency`, orders, and PayPal `OrdersCreate` are **BRL** checkout data. USD may appear only as catalog reference metadata such as `Product.referencePriceUsd`; it must never flow into checkout arithmetic. No ledger currency column is added while checkout is single-currency; supporting another currency requires a new Specification and explicit conversion, rounding, persistence, and reconciliation rules.
5. **Scale / rounding:** listing prices and PayPal capture use 2 decimal places (`toFixed(2)` at the PayPal boundary). Commission keeps exact Decimal `gross × rate` (extra fractional digits from the rate are preserved). This is the existing policy; a separate banker's-rounding step is not introduced. The formal catalog (currency, scale, rounding mode, no-refund rule, and shared helpers) is [`docs/architecture/money-policy.md`](../architecture/money-policy.md) and `server/src/shared/money/policy.ts`.
6. **Status:** applied credit and compensation movements both use `PAID`; `REFUNDED` remains payment lifecycle state and never overwrites an applied ledger row.
7. **Database enforcement:** `@@unique([sellerId, entryType, economicEventId])` prevents duplicate economic movements. Credit identity is the order ID; compensation identity is the durable refund ID. CHECK constraints retain `net = gross - commission`, require credit amounts non-negative, require compensation amounts non-positive, and bind refund identity only to compensation rows.
8. **Completion gate:** `PENDING`, `PROCESSING`, and `FAILED` refunds cannot create seller compensation. The transaction-scoped ledger helper re-reads `Refund.status = COMPLETED`. `recordProviderConfirmedCompletion` persists the provider refund identity, transitions the refund, appends any required compensation, and updates seller projections in one PostgreSQL transaction. It performs no provider HTTP work.
9. **Periodic reconciliation (issue #45):** an in-process job (same `setInterval` + `unref` pattern as PayPal GET reconcile / reservation expiry) compares each `Seller.balance` to `SUM(netAmount) WHERE status = 'PAID'`. There is no Render cron, Redis, or extra worker.

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

The TASK-0013 migration is backward-compatible for existing credits, but rollback after compensation data exists requires retaining or archiving those additional movements; restoring one row per `(sellerId, orderId)` would otherwise destroy history. The reconciliation job remains independently removable without changing ledger writes.

## Consequences

- Duplicate payment confirmation remains a no-op after the order claim; economic-event uniqueness is defense in depth. Duplicate provider-confirmed completion and compensation insertion are no-ops and cannot double-debit the projection.
- Demo seed sets `Seller.balance` to `"0.00"` with no `SellerTransaction` rows so the projection matches an empty PAID `SUM(netAmount)`. Re-seed on an existing demo seller writes catalog `"0.00"` only when there are no PAID ledger rows; if PAID rows exist, the projection is set to that SUM so credited net is not wiped. Non-zero production credits are written only by `confirmPayment`. `GET /commissions/balance` returns the Decimal projection without `Number()`. The in-process job periodically realigns a drifted projection to PAID SUM (ledger wins).
- A captured-but-unfulfillable payment can create a durable refund obligation without a seller debit. Compensation is appended only when an original applied credit exists.
- Multiple API replicas may run the same sweep; extra executions no-op after the first correction.
