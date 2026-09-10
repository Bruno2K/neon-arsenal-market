# ADR 0024 — Compensate unfulfillable PayPal captures with idempotent full refunds

## Status

Accepted

## Context

The payment path correctly refuses to confirm a captured payment when the order no longer owns a valid listing reservation. This preserves unique-item correctness, but a PayPal order may already be `COMPLETED`. The application then has an external financial effect with no local fulfillment and requires deterministic compensation.

The seller ledger originally allowed one `SellerTransaction` per `(sellerId, orderId)`, and `Seller.balance` was a projection of PAID rows. That representation could not express an append-only credit followed by a distinct reversing movement for the same order.

## Decision

1. **Technical compensation is automatic and full.** When trusted PayPal state proves capture completed but local fulfillment is impossible because the reservation expired, was released, or belongs elsewhere, Neon Arsenal must converge by refunding the full captured BRL amount.
2. **Do not resurrect stale fulfillment.** A captured payment never overrides current listing reservation/ownership state.
3. **Refund ownership is durable.** PostgreSQL persists a refund obligation and its lifecycle independently of transient process state. Database uniqueness protects one economic refund per capture/order identity.
4. **PayPal remains the authority for remote refund completion.** A successful local attempt is not proof. Remote completion must be observed through trusted provider evidence.
5. **Provider HTTP remains outside database transactions.** Local claim/state is committed before or around provider work so crashes remain reconcilable.
6. **Financial history is append-only.** Existing seller credit is not deleted or rewritten to erase history. A refund that reverses an applied seller credit creates a separate compensating ledger movement.
7. **No synthetic debit.** If the failed capture never produced seller credit locally, buyer refund completion does not debit the seller.
8. **Seller.balance stays a projection.** A compensating ledger mutation and balance projection update occur in the same PostgreSQL transaction.
9. **Reconciliation owns partial-completion recovery.** Remote-success/local-crash, provider timeout/unknown outcome, duplicate events, and out-of-order events converge from persisted state and current trusted provider state.
10. **Non-convergence is explicit.** Bounded automated retries may leave a FAILED/unresolved refund requiring operator intervention; the system must not hide this state.
11. **Scope is intentionally narrow.** Partial refunds, buyer-requested refunds, disputes, chargebacks, FX, and a public refund workflow require separate product decisions.

## Ledger consequence

ADR 0011's original `@@unique([sellerId, orderId])` and PAID-only projection model had to evolve before append-only reversals could be implemented. The replacement preserves:

- authoritative PostgreSQL ledger;
- Decimal BRL arithmetic;
- idempotency by economic event;
- auditable payment and compensation history;
- deterministic `Seller.balance` projection;
- migration compatibility with existing PAID rows.

The implementation uses the minimum model required by SPEC-0013 and does not generalize the ledger into a separate finance platform.

## Failure model

```text
local claim persisted
      ↓
PayPal refund call
      ↓
remote result known?
  yes           no/timeout
   ↓               ↓
persist/apply   reconcile provider
local result        ↓
   ↓           completed? ── no → retry/FAILED
crash safe          ↓
               apply local result
```

Every arrow may be retried. Durable uniqueness and provider identity prevent duplicate economic effects.

## Consequences

- The system has a real compensation story for distributed partial failure without introducing distributed transactions.
- Unique-item correctness remains stronger than payment-arrival timing.
- Refund state and ledger compensation require durable schema support.
- Reconciliation is responsible for both pending capture confirmation and refund convergence.
- Non-converged states remain operator-visible instead of being hidden behind a terminal application error.
- A future architecture-seam PR may use this payment/refund boundary if abstraction provides measurable testability benefit, but this ADR does not require a general hexagonal rewrite.

## Supersedes / amends

- Amends ADR 0011 sections that predate the refund-compensation model and assumed one row per `(sellerId, orderId)` was sufficient.
- Extends ADR 0012's local-transaction/external-side-effect model to refund compensation.
- Preserves ADR 0022: all refund and ledger amounts are BRL.

## Renumbering note

This decision was originally committed as `ADR 0023 — refund compensation`. PR08 renumbered it to `ADR 0024` because `ADR 0023 — rate-limit client identity` already existed. The decision itself is unchanged; only the durable identifier was corrected to restore unique ADR numbering.
