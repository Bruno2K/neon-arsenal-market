---
id: TASK-0014
status: Ready
version: 1
source_spec: SPEC-0013
source_spec_version: 1
source_plan: PLAN-0012
source_plan_version: 1
baseline_revision: f6428d7243c257e5068ddd78756aee45796c8054
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [TASK-0014] — Execute idempotent PayPal refund compensation

## Status

`Ready`. TASK-0013 is Done and its refund/ledger foundation is merged on the current main baseline.

## Source

- Specification: `SPEC-0013` v1
- Plan: `PLAN-0012` v1
- Plan node: provider refund execution

## Objective

Make a late or otherwise unfulfillable PayPal capture converge through exactly one full provider refund and exactly-once local application.

## Scope

PayPal refund utility/adapter work, payment-service integration, durable claim/use of TASK-0013 model, duplicate/out-of-order handling, focused tests. Reconciliation scheduling/operational sweep remains TASK-0015.

## Allowed Files

- `server/src/modules/payments/**`
- `server/src/shared/utils/paypal*`
- `server/src/shared/config/paypal.ts`
- `server/src/shared/observability/**`
- `server/src/modules/audit/**`
- `server/src/shared/outbox/**`
- `server/src/__tests__/**`
- `docs/testing.md`
- `docs/verification/**`

## Preconditions

TASK-0013 is Done via PR #223 and its migration/model are present on baseline `f6428d7243c257e5068ddd78756aee45796c8054`.

## Acceptance Criteria

- [ ] `AC-01` Completed PayPal capture with invalid reservation creates/uses refund obligation and never sells the stale listing. **Evidence:** integration
- [ ] `AC-02` Duplicate/concurrent paths cause at most one economic provider refund. **Evidence:** integration/concurrency
- [ ] `AC-03` Provider-completed refund can be replayed after crash and locally applied once. **Evidence:** integration
- [ ] `AC-07` Duplicate/out-of-order events converge from provider state and local invariants. **Evidence:** test/integration
- [ ] `AC-08` Timeout/unknown outcome is not marked complete and remains recoverable. **Evidence:** test/integration

## Dependencies

- `TASK-0013`

## Risks

Duplicate irreversible provider calls, mistaking timeout for failure, trusting client/event ordering, or coupling provider HTTP to a DB transaction.

## Verification Command

```bash
npm run typecheck --prefix server
npm run test:unit --prefix server -- --reporter=dot
npm run test:integration --prefix server -- --reporter=dot
npm run test:contract --prefix server -- --reporter=dot
git diff --check
```

## Expected Evidence

Focused tests prove late capture, duplicate replay, provider success/local crash recovery, no listing theft, and no second refund.

## Stop Conditions

- Stop if PayPal refund API semantics cannot be confirmed from the supported provider boundary.
- Stop before inventing partial/customer-requested refunds.
- Stop before editing outside Allowed Files.

## Traceability

`SPEC → PLAN → TASK(S) → PR → EVIDENCE`

## Change History

- 2026-09-08 — v1 — Blocked provider task created after human approval.
- 2026-09-09 — TASK-0014 released to Ready after TASK-0013 / PR #223 merged.
