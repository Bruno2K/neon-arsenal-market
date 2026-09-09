---
id: PLAN-0011
status: Draft
version: 1
source_spec: SPEC-0012
source_spec_version: 1
baseline_revision: b3024e892fcfbba0d2137515aca9559bb1347015
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [PLAN-0011] — Implement refund, reversal, and reconciliation

## Status

`Draft`. The source Specification is Accepted, but roadmap PR 03 security hardening is still in progress. Implementation Tasks remain Blocked until PR 03 is merged and this Plan is rebased/revalidated against the new main baseline.

## Source

- Specification: `SPEC-0012` v1
- ADR: `ADR 0023`
- Consolidated roadmap: Initiative 04 — Refund, reversão de ledger e reconciliação
- Baseline inspected: `b3024e892fcfbba0d2137515aca9559bb1347015`

## Current State

Payment confirmation is idempotent and transactionally applies order confirmation, listing sale, seller ledger credit, seller balance, audit, and outbox. Capture is avoided when expiry is known before capture. If trusted PayPal state is already `COMPLETED` but local reservation validation fails, confirmation returns 409 and webhook/reconciliation record or log the mismatch without refunding the buyer. `PaymentStatus.REFUNDED` exists but has no application path. The seller ledger cannot record a separate reversal because `(sellerId, orderId)` is unique.

## Goal

Implement the accepted full technical-refund contract with durable idempotency, append-only financial compensation, crash recovery, and operational reconciliation while preserving listing, payment, and ledger invariants.

## Affected Areas

Candidates:
- `server/prisma/schema.prisma` and a forward migration.
- `server/src/modules/payments/**`.
- `server/src/modules/commissions/**` and ledger reconciliation.
- PayPal utility/adapter files under `server/src/shared/**`.
- Audit/outbox/metrics types where refund evidence is required.
- Payment, reservation, webhook, and seller-ledger integration tests.
- OpenAPI only if observable public payment state changes.
- `docs/adr/0011-seller-ledger.md`, money policy/invariants, testing docs, observability, and runbook.

## Architecture

Keep the modular monolith and PostgreSQL source of truth. Introduce only the minimum durable refund model and PayPal refund operation required by SPEC-0012. Provider HTTP stays outside DB transactions. Local compensation is transactional. Do not introduce a generic provider abstraction solely for future providers; PR 09 may later extract a seam if this implementation demonstrates concrete coupling cost.

## Database

Expected migration responsibilities:
1. Persist refund obligation/lifecycle, amount, provider identities, reason, and timestamps with uniqueness sufficient for idempotency.
2. Evolve seller ledger representation so payment credit and refund compensation can coexist append-only for the same order/seller.
3. Preserve existing PAID rows and balance interpretation during migration.
4. Add constraints/indexes that prevent duplicate economic compensation and support reconciliation scans.
5. Use only forward migrations; do not rewrite applied migrations.

Exact column/model naming is an implementation choice constrained by SPEC-0012 and ADR 0023.

## Implementation Sequence

1. **TASK-0012 — Local refund and ledger model:** schema/migration, durable refund claim/state, append-only compensation contract, backward-compatible existing ledger data, focused PostgreSQL tests.
2. **TASK-0013 — PayPal refund execution:** provider refund API integration, idempotent application, late-capture compensation flow, duplicate/out-of-order behavior, crash-safe local completion.
3. **TASK-0014 — Reconciliation and operations:** reconcile unresolved refunds, safe retries, metrics/logs/audit/runbook, full regression and evidence.

Default to separate PRs if each Task produces a reviewable and independently safe increment. Do not merge an intermediate schema state that weakens current payment correctness.

## Task Graph

```text
TASK-0012 → TASK-0013 → TASK-0014
```

Sequential execution. The tasks overlap payment/ledger invariants and should not be implemented in parallel.

## Testing Strategy

- TASK-0012: disposable PostgreSQL migration, constraint, ledger-credit + reversal, balance projection, duplicate local-claim tests.
- TASK-0013: PayPal adapter unit tests plus PostgreSQL integration for late capture, duplicate webhook/retry, provider-success/local-crash replay, and no seller debit when no credit exists.
- TASK-0014: reconciliation repeatability, failure-state recovery, out-of-order events, operator evidence, existing payment/reservation/ledger suites.
- Final full backend unit/contract/integration/build and documentation checks.

## Verification Strategy

Local focused commands are Task-specific. Final convergence requires:
- Prisma generate and migrate deploy against disposable PostgreSQL 16.
- Backend typecheck, unit, contract, integration tests, and build.
- Relevant frontend/contract checks only if public contract changes.
- Documentation validator + validator tests.
- `git diff --check`.
- Remote CI and review of migration/financial invariants.

## Risks

- **Duplicate economic refund:** mitigate with durable uniqueness, provider identity, and reconciliation before retrying unknown outcomes.
- **Double seller debit:** separate compensation event identity and transactional balance update.
- **Historical ledger migration error:** preserve existing PAID rows and prove pre/post projection equivalence on fixtures.
- **Remote success/local crash:** persist recoverable state and reconcile provider outcome.
- **Race with listing re-reservation:** never mutate listing ownership based on stale capture.
- **Scope creep into generic finance platform:** enforce non-goals and stop conditions.

## Dependencies

- `SPEC-0012` Accepted.
- ADR 0023 Accepted.
- Roadmap PR 02 / BRL contract merged.
- Roadmap PR 03 security hardening must merge before this Plan can move from Draft to Ready.
- PayPal provider behavior for full refunds must be verified against the SDK/API used by the repository during TASK-0013.

## Stop Conditions

- Stop if partial/customer-requested refund behavior is required.
- Stop if implementation requires changing the BRL-only contract.
- Stop if a destructive migration cannot preserve existing ledger history.
- Stop if provider API behavior cannot be confirmed.
- Stop if a proposed retry can duplicate an irreversible provider effect.
- Stop on conflict with the post-PR03 main baseline and re-plan before code edits.
- Stop before introducing a new queue/service/provider abstraction without a demonstrated requirement.

## Definition of Done

All SPEC-0012 criteria have traceable evidence; one full refund per capture is enforced; remote/local crash states reconcile; seller history remains append-only; balance projection remains correct; no stale capture steals a listing; runbook covers intervention; remote CI is green; residual risks are explicit.

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

- Specification: `SPEC-0012` v1
- Plan: `PLAN-0011` v1
- Tasks: `TASK-0012`, `TASK-0013`, `TASK-0014`
- PR: pending
- Evidence: pending

## Change History

- `v1` — Draft implementation decomposition pending PR 03 convergence — 2026-09-08
