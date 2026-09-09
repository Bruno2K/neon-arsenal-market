---
id: TASK-0015
status: Ready
version: 1
source_spec: SPEC-0013
source_spec_version: 1
source_plan: PLAN-0012
source_plan_version: 1
baseline_revision: 2ec7897edabc3ab7b7b0ec68a5e8bddb89570799
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [TASK-0015] — Reconcile refunds and publish operational evidence

## Status

`Ready`. TASK-0014 is Done and idempotent provider refund execution is merged on the current main baseline.

## Source

- Specification: `SPEC-0013` v1
- Plan: `PLAN-0012` v1
- Plan node: reconciliation and operations

## Objective

Make unresolved refund states recover automatically when safe and surface explicit operator evidence when convergence cannot be achieved.

## Scope

Refund reconciliation scan/loop, bounded retry policy using persisted state, metrics/logs/traces/audit, runbook, regression/evidence. No new infrastructure service or queue.

## Allowed Files

- `server/src/modules/payments/**`
- `server/src/modules/commissions/**`
- `server/src/shared/config/**`
- `server/src/shared/observability/**`
- `server/src/shared/runtime/**`
- `server/src/__tests__/**`
- `docs/observability.md`
- `docs/operations/runbook.md`
- `docs/testing.md`
- `docs/verification/**`

## Preconditions

TASK-0014 is Done via PR #225 and provider refund execution is present on baseline `2ec7897edabc3ab7b7b0ec68a5e8bddb89570799`.

## Acceptance Criteria

- [ ] `AC-03` Remote-completed/local-incomplete refunds converge through reconciliation. **Evidence:** integration
- [ ] `AC-06` Ledger/balance reconciliation remains correct after refund and repeat sweeps no-op. **Evidence:** integration
- [ ] `AC-07` Out-of-order states converge without relying on event arrival order. **Evidence:** integration
- [ ] `AC-08` Recoverable failure states retry safely and unresolved states remain explicit. **Evidence:** integration
- [ ] `AC-09` Safe logs/metrics/runbook identify failed/non-converged refunds and operator action. **Evidence:** static check/runtime
- [ ] `AC-10` Full regression, docs contracts, and remote CI pass. **Evidence:** CI

## Dependencies

- `TASK-0014`

## Risks

Busy retry loops, duplicate provider effect during unknown-outcome recovery, hidden failures, or high-cardinality telemetry.

## Verification Command

```bash
npm run typecheck --prefix server
npm run test:unit --prefix server -- --reporter=dot
npm run test:contract --prefix server -- --reporter=dot
npm run test:integration --prefix server -- --reporter=dot
npm run build --prefix server
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
git diff --check
```

## Expected Evidence

Repeated reconciliation is idempotent; remote/local divergence converges when provider state permits; unresolved cases remain queryable and observable; runbook contains recovery steps; CI is green.

## Stop Conditions

- Stop before adding external queue/worker infrastructure.
- Stop if automatic recovery would require guessing provider outcome.
- Stop before editing outside Allowed Files.

## Traceability

`SPEC → PLAN → TASK(S) → PR → EVIDENCE`

## Change History

- 2026-09-08 — v1 — Blocked reconciliation task created after human approval.
- 2026-09-09 — TASK-0015 released to Ready after TASK-0014 / PR #225 merged.
