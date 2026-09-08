---
id: TASK-0009
status: Done
version: 1
source_issue: "#63"
source_spec: SPEC-0008
source_spec_version: 1
source_plan: PLAN-0005
source_plan_version: 1
baseline_revision: 27c94eb46d24353aee866852236c83134a89702e
owner: Neon Arsenal Engineering
created: 2026-09-06
updated: 2026-09-06
---

# [TASK-0009] — SLOs, error budget, diagnosis, catalog test

## Status

`Done`.

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

- `docs/operations/slos.md`
- `docs/runbook.md`
- `docs/observability.md`
- `docs/architecture/current-state.md`
- `docs/roadmap.md`
- `README.md`
- `server/src/shared/observability/__tests__/instrument-catalog.test.ts`

## Preconditions

`TASK-0008` JSON catalog exists. `SPEC-0008` Accepted.

## Acceptance Criteria

- [x] `AC-01` Each SLO cites an existing instrument or an explicit unmeasurable and proxy. **Evidence:** manual review
- [x] `AC-02` Availability SLI is 5xx per recorded HTTP request, excluding 4xx. **Evidence:** static check
- [x] `AC-03` Error budget is the 30-day recorded-request remainder. **Evidence:** static check
- [x] `AC-04` Diagnosis uses `request.id` and `trace_id` and forbids secret search. **Evidence:** manual review
- [x] `AC-05` Unit test proves documented metric names and attribute keys. **Evidence:** test
- [x] `AC-06` No payment or reservation semantic change. **Evidence:** static check

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

- Stop if an SLO cannot map to an existing signal or explicit proxy.
- Stop before adding new instruments, payment changes, or files outside `Allowed Files`.

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-06 — v1 — SLO and instrument-catalog Task completed.
