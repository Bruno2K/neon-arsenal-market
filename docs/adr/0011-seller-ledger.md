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
5. **Scale / rounding:** listing prices and PayPal capture use 2 decimal places (`toFixed(2)` at the PayPal boundary). Commission keeps exact Decimal `gross × rate` (extra fractional digits from the rate are preserved). This is the existing policy; a separate banker's-rounding step is not introduced.
6. **Status:** `SellerTransaction.status` is `PaymentStatus` (`PENDING`, `PAID`, `REFUNDED`). Confirmation writes `PAID`. `PENDING` is the unused column default. `REFUNDED` exists for enum alignment with `Order.paymentStatus`; no application path writes it. Do not invent refunds.
7. **Database enforcement:** keep `@@unique([sellerId, orderId])`. Add CHECK constraints `netAmount = grossAmount - commissionAmount` and non-negative amounts.
8. **Issue #45 (not implemented here):** periodic financial reconciliation would compare `Seller.balance` to `SELECT sellerId, SUM("netAmount") FROM "SellerTransaction" WHERE status = 'PAID' GROUP BY "sellerId"` and treat ledger SUM as the correct figure. No job, cron, or product UI is added in this change.

## Rollback

Drop the two CHECK constraints. Unique `(sellerId, orderId)` and the confirm-path claim remain from earlier migrations. Documentation and the shared `computeSellerLedgerAmounts` helper can be reverted independently; doing so would not restore a second source of truth.

## Consequences

- Duplicate payment confirmation remains a no-op after the order claim (`paymentStatus = PENDING AND status = PENDING`); the unique constraint is defense in depth.
- Demo seed sets `Seller.balance` to `"0.00"` with no `SellerTransaction` rows so the projection matches an empty PAID `SUM(netAmount)`. Re-seed on an existing demo seller writes catalog `"0.00"` only when there are no PAID ledger rows; if PAID rows exist, the projection is set to that SUM so credited net is not wiped. Non-zero production credits are written only by `confirmPayment`. `GET /commissions/balance` returns the Decimal projection without `Number()`. Periodic SUM-vs-projection reconciliation remains #45.
- Capture after reservation expiry still creates no ledger row (ADR 0002).
