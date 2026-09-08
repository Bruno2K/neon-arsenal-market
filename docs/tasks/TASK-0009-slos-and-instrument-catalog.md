---
id: TASK-0009
status: Ready
version: 1
source_issue: "#63"
source_spec: SPEC-0008
source_spec_version: 1
source_plan: PLAN-0005
source_plan_version: 1
baseline_revision: 27c94eb46d24353aee866852236c83134a89702e
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-08
---

# [TASK-0009] — SLOs, error budget, diagnosis, catalog test

## Status

`Ready`

## Source

- Specification: `SPEC-0008`
- Plan: `PLAN-0005`
- Issue: #63

## Objective

Define measurable SLOs and a 30-day error budget from existing instruments, document request/trace diagnosis and runbook alert thresholds, and add a unit test that the documented catalog still exists.

## Scope

`docs/operations/slos.md`, runbook diagnosis/alerts, observability/current-state/roadmap/README pointers, `server/src/shared/observability/__tests__/instrument-catalog.test.ts`.

Out of scope: new meters, pager vendor, `src/`, reservation/payment code.

## Allowed Files

Only observability docs, runbook/roadmap pointers and the instrument-catalog test named in Scope.

## Preconditions

`TASK-0008` JSON catalog exists. `SPEC-0008` Accepted.

## Acceptance Criteria

- [ ] `AC-01`: Each SLO cites an existing instrument or an explicit unmeasurable + proxy **Evidence:** static check
- [ ] AC-02: Availability SLI is 5xx / recorded HTTP, not 4xx
- [ ] AC-03: Error budget is 30-day recorded-request remainder
- [ ] AC-04: Diagnosis uses request.id / trace_id and forbids secret search
- [ ] AC-05: Unit test proves documented metric names and attribute keys
- [ ] AC-06: No payment/reservation semantic change

## Dependencies

`TASK-0008`

## Risks

`payments.failed` / `paypal.webhooks.failed` mix business expiry with ops failures.

## Verification Command

```bash
python3 scripts/ai-factory/validate.py
cd server && npm run test:unit
```

## Expected Evidence

Commands exit 0. Catalog test covers documented meters. Diff review shows no `src/` or payment runtime edits.

## Stop Conditions

Stop if the work needs a new meter, a pager vendor, or a reservation/payment runtime edit.

## Traceability

GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY

## Change History

- 2026-09-08 — Migrated to the task artifact contract.
