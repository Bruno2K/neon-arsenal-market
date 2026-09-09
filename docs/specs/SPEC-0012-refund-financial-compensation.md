---
id: SPEC-0012
status: Accepted
version: 1
owner: Bruno
created: 2026-09-08
updated: 2026-09-08
---

# [SPEC-0012] — Refund and financial compensation

## Status

Accepted. The owner approved automatic full compensation when PayPal capture succeeds but the marketplace can no longer fulfill the order because the reservation is expired or lost.

## Problem

The current payment flow prevents a new PayPal capture when the local reservation is already invalid. However, PayPal may already report an order as `COMPLETED` before the application discovers that the listing can no longer be fulfilled. In that state `confirmPayment()` correctly refuses to sell the listing, but no refund path exists. The external provider can therefore hold buyer funds while the local order remains unfulfilled. The seller ledger also has no append-only reversal path.

## Goal

Guarantee deterministic convergence between PayPal and PostgreSQL when a captured payment cannot be fulfilled locally: preserve listing ownership invariants, create at most one economic refund for a capture, retain an auditable append-only financial history, and provide crash-safe reconciliation.

## Actors

- Buyer whose PayPal payment was captured.
- Seller whose balance or ledger may require compensation.
- PayPal as external payment/refund authority.
- Webhook handler and payment reconciliation process.
- Operator handling states that do not converge automatically.

## Scope

- Automatic full refund for a valid PayPal capture that cannot be fulfilled because the local reservation is expired, released, or no longer belongs to that order.
- Durable local refund obligation/state and provider identifiers.
- Idempotent PayPal refund execution and replay.
- Append-only seller-ledger compensation when seller credit was previously applied.
- Seller balance projection update in the same local transaction as the compensating ledger entry.
- Duplicate and out-of-order webhook handling.
- Crash recovery and reconciliation for remote/local partial completion.
- Logs, metrics, audit evidence, and runbook guidance.

## Non-goals

- Partial refunds.
- Buyer-initiated or commercial/customer-service refunds.
- Chargebacks, disputes, or PayPal claims.
- Multi-currency refunds or FX.
- Reassigning a listing to a stale order after reservation loss.
- Introducing a queue, new service, Redis, Kafka, SQS, or a finance microservice.
- Hiding non-converged states by mutating historical financial records.

## Business Rules

- `BR-01`: A PayPal capture must never override the current valid listing reservation.
- `BR-02`: If PayPal is `COMPLETED` and local fulfillment cannot succeed, the system creates a durable obligation for one full refund.
- `BR-03`: A single PayPal capture may produce at most one economic full refund.
- `BR-04`: Retrying webhook handling, reconciliation, provider calls, or local application must not duplicate refund effects.
- `BR-05`: A refund is considered complete only after trusted provider evidence confirms completion; attempting a provider call is not completion.
- `BR-06`: Seller financial history is append-only. Applied credits are not deleted or rewritten to erase history; compensation is a distinct reversing economic entry.
- `BR-07`: `Seller.balance` remains a materialized projection of effective seller-ledger entries and is updated atomically with each local ledger mutation.
- `BR-08`: If the seller was never credited for the failed order, refund completion must not create a synthetic seller debit.
- `BR-09`: Provider HTTP effects remain outside PostgreSQL transactions.
- `BR-10`: A state that cannot converge after bounded automatic attempts must remain explicit and operationally actionable.

## Invariants

- `INV-REFUND-SINGLE-EFFECT`: one provider capture produces at most one completed economic refund.
- `INV-REFUND-OBLIGATION`: a captured-but-unfulfillable order has a durable compensation obligation until provider-confirmed convergence.
- `INV-REFUND-IDEMPOTENCY`: replay cannot duplicate provider refund or local compensation effects.
- `INV-LEDGER-APPEND-ONLY`: financial history is preserved through compensating entries rather than destructive mutation.
- `INV-BALANCE-PROJECTION`: seller balance equals the effective net sum represented by the authoritative ledger.
- `INV-LISTING-RESERVATION-OWNERSHIP`: a stale payment cannot sell a listing whose valid reservation belongs elsewhere.
- `INV-REFUND-CRASH-RECOVERY`: every remote/local partial completion state has a deterministic reconciliation path.

## State Transitions

Order lifecycle remains separate from payment/refund lifecycle.

```text
Order:
PENDING → CONFIRMED
   ↓
CANCELLED

Payment:
PENDING → PAID → REFUNDED

Refund:
PENDING → PROCESSING → COMPLETED
                   ↘ FAILED
FAILED → PROCESSING
```

A refund failure is recoverable, not terminal, while provider reconciliation remains possible.

## API / Data Contract

- Persist a dedicated refund record or equivalent durable aggregate keyed to the local order and remote capture/payment identity.
- Persist provider refund identity once known.
- Persist refund amount in BRL using existing Decimal rules.
- Persist reason sufficient to distinguish technical compensation for unfulfillable capture.
- Preserve timestamps and status required for reconciliation and operator diagnosis.
- The persistence model must enforce idempotency with database uniqueness, not process memory.
- Public buyer-initiated refund endpoints are not required by this Specification.
- Existing payment/order APIs may expose final payment state consistently if current contracts already surface it; any new public contract requires OpenAPI alignment.

## Concurrency Model

- Refund creation/claim must use a database uniqueness or conditional-write boundary so concurrent webhook and reconciliation paths cannot create two obligations.
- Local compensation must be applied in one PostgreSQL transaction containing refund/local-state transition, compensating ledger entry when required, seller-balance projection update, audit/outbox evidence as applicable.
- PayPal HTTP calls occur outside the local transaction.
- Concurrent retries must converge through persisted state and provider identity.
- Listing state is never rolled back from another buyer's valid reservation or sale to satisfy a stale captured payment.

## Failure Modes

- **Provider timeout before known result:** keep durable refund state unresolved; reconcile against provider before issuing another economic action when provider identity/outcome is uncertain.
- **Provider refund succeeds, process crashes before PostgreSQL update:** reconciliation observes provider completion and applies local completion idempotently.
- **PostgreSQL write fails after provider success:** same as above; do not infer refund failure from local rollback.
- **Duplicate capture webhook:** claim/event replay produces no duplicate refund or ledger compensation.
- **Out-of-order approved/completed/refund events:** trusted current provider state plus local invariants determine action; event arrival order is not authoritative.
- **Reservation expires before capture:** do not capture; no refund is required.
- **Already captured before expiry is noticed:** create/refetch the refund obligation and converge to full refund.
- **Seller credit never occurred:** complete buyer refund without seller debit.
- **Automatic reconciliation repeatedly fails:** retain explicit failure state, emit operational signal, and require human intervention.

## Security

- Trust refund/capture status only from authenticated PayPal REST/webhook mechanisms already used by the payment boundary.
- Never log provider secrets or full sensitive payment payloads.
- Do not allow a client request to mark a refund complete.
- Administrative/manual recovery, if added later, must require explicit authorization and separate specification where it changes financial semantics.

## Observability

At minimum expose structured signals for:
- refund obligation created;
- provider refund requested;
- provider refund confirmed;
- refund retry/failure;
- reconciliation scanned/converged/failed;
- local compensating ledger applied;
- non-converged refund requiring intervention.

Logs and traces should include local order/refund IDs and safe provider identifiers, without secrets. Metrics must avoid high-cardinality seller/customer labels.

## Backward Compatibility

Existing successful payment confirmation remains unchanged. Existing prevention of capture after known reservation expiry remains unchanged. The change adds compensation for states that currently remain inconsistent. Schema changes require forward migrations. Existing ledger/history must remain interpretable after migration.

## Acceptance Criteria

- [ ] `AC-01` A PayPal `COMPLETED` payment for an order whose reservation cannot be fulfilled results in a durable full-refund obligation without selling or reclaiming the listing. **Evidence:** integration
- [ ] `AC-02` Duplicate webhook, concurrent reconciliation, and retry paths result in at most one economic provider refund. **Evidence:** integration/concurrency
- [ ] `AC-03` Provider-confirmed refund completion can be replayed after a process crash and converges local refund/payment state exactly once. **Evidence:** integration
- [ ] `AC-04` If seller credit had been applied, refund completion creates an append-only compensating ledger entry and adjusts `Seller.balance` in the same PostgreSQL transaction. **Evidence:** integration
- [ ] `AC-05` If seller credit was never applied, refund completion creates no seller debit. **Evidence:** integration
- [ ] `AC-06` Ledger and balance reconciliation remain correct after payment + refund compensation and repeated reconciliation is a no-op. **Evidence:** integration
- [ ] `AC-07` Event ordering does not control correctness: duplicate and out-of-order supported PayPal events converge according to provider state and local invariants. **Evidence:** test/integration
- [ ] `AC-08` Provider timeout, remote-success/local-crash, and local-write-failure scenarios retain a deterministic recovery path and never silently mark a refund complete. **Evidence:** test/integration
- [ ] `AC-09` Refund failures and unresolved states emit safe operational evidence and are documented in the runbook. **Evidence:** static check/runtime
- [ ] `AC-10` Unit, contract, PostgreSQL integration, documentation contracts, and remote CI pass with no weakening of existing payment, reservation, or ledger invariants. **Evidence:** CI

## Verification Strategy

- Focused payment/refund unit tests for state and provider interpretation.
- PostgreSQL integration tests for claims, uniqueness, append-only compensation, balance projection, crash-recovery replay, and concurrency.
- Existing reservation-expiration, payment-confirmation, webhook-idempotency, and seller-ledger tests as regression evidence.
- PayPal adapter tests using deterministic mocks at the external boundary; PostgreSQL behavior must not be replaced by mocks.
- Documentation contracts and migration deployment on disposable PostgreSQL 16.
- Remote CI as final gate.

## Decisions / References

- `docs/adr/0002-reservation-expiration.md`
- `docs/adr/0011-seller-ledger.md`
- `docs/adr/0012-transactional-outbox.md`
- `docs/adr/0022-single-checkout-currency.md`
- `docs/adr/0023-refund-compensation.md`
- `docs/architecture/money-policy.md`
- `server/src/modules/payments/payments.service.ts`
- `server/prisma/schema.prisma`

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

- Specification: `SPEC-0012` v1
- Plan: `PLAN-0011` v1
- Tasks: `TASK-0012`, `TASK-0013`, `TASK-0014`
- PR: pending
- Evidence: pending

## Change History

- 2026-09-08 — v1 accepted: automatic full technical refund, append-only compensation, idempotent reconciliation, and explicit human escalation for non-convergence.
