# TASK-0015 refund reconciliation and operations evidence

## Authority and scope

- `SPEC-0013` v1, `PLAN-0012` v1, `TASK-0015` v1, ADR 0023.
- Baseline: post-PR #226 `main` at `454ad13` (TASK baseline ancestor `2ec7897`).
- Scope remains the modular-monolith API, PostgreSQL, the existing in-process PayPal sweep, and full
  technical refunds only. No migration, public API, queue, cache, new service, partial refund, or customer
  refund workflow is introduced.

## Implemented evidence

- Bounded selection uses `Refund.status + updatedAt`: PENDING 2m, PROCESSING 5m, FAILED 30m; oldest 20.
- A conditional `id + status + updatedAt` update is the lightweight replica-safe claim.
- Known `providerRefundId` uses Payments v2 RefundsGet. Unknown prior POST outcome replays CapturesRefund
  with `buildPayPalRefundRequestId(refund.id)`, preserving one provider economic identity.
- COMPLETED reuses the existing atomic local completion and append-only compensation transaction.
- PENDING stays PROCESSING; timeout/429/5xx/request-in-progress stays retryable; trusted FAILED/CANCELLED
  becomes FAILED. No retry limit guesses provider outcome. Terminal outcomes and ambiguity older than 24h
  emit operator-required evidence.
- Per-item logs/traces carry safe local/provider IDs, transition, and reason. Seven no-label counters cover
  scanned, attempted, converged, pending, retryable, terminal, and operator-required outcomes.

## Acceptance mapping

- AC-03/07/08: `refund.reconciliation.integration.test.ts` proves remote/local recovery, crash replay,
  unknown-outcome stable-key replay, transient/pending/terminal classification, and no downgrade.
- AC-06: the same suite proves exact one-time compensation and repeated refund/ledger sweep idempotency.
- AC-09: metrics tests plus `docs/observability.md` and the refund runbook section document safe evidence,
  investigation, escalation, and forbidden operator actions.
- AC-10: exact local and remote CI results are recorded in the PR description; no unexecuted check is
  represented as passing here.

## Evaluation

Target rubric: specification fidelity 2, correctness/failure behavior 2, security/governance 2,
architecture/scope 2, verification/operations 2. Final score is assigned only after the exact verification
commands and diff review complete.
