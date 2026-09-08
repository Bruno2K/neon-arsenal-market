---
id: TASK-0010
status: Ready
version: 1
source_issue: "#55"
source_spec: SPEC-0009
source_spec_version: 1
source_plan: PLAN-0006
source_plan_version: 1
baseline_revision: 624f14a0ed3bbd8a2671e1fcace0f70866ab9106
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-08
---

# [TASK-0010] — Build and run the k6 capacity harness

## Status

`Ready`

## Source

- Specification: `SPEC-0009`
- Plan: `PLAN-0006`
- Issue: #55

## Objective

Deliver safe k6 profiles plus correlated capacity evidence from an isolated production-like environment.

## Scope

`load-tests/k6/`, `docs/performance/`, and SPEC/PLAN/TASK traceability. No application runtime, schema, deploy or provider-contract change.

## Allowed Files

`load-tests/k6/`, `docs/performance/`, `.github/workflows/load-test.yml`, and the directly related SPEC/PLAN/TASK artifacts. Stop for runtime, schema, deploy or provider-contract changes.

## Preconditions

`SPEC-0009` Accepted; `PLAN-0006` Ready. Runtime phase requires a disposable API/PostgreSQL target and operator-approved test credentials.

## Acceptance Criteria

- [ ] `AC-01`: Harness inspection succeeds and exposes five gated profiles **Evidence:** static check
- [ ] AC-02: Default smoke and catalog are read-only
- [ ] AC-03: Orders require explicit write opt-in and unique disposable listing IDs
- [ ] AC-04: Payment is replay-only; webhook profile rejects invalid signatures
- [ ] AC-05: JSON summary and report capture HTTP, API, PostgreSQL and invariant evidence
- [ ] AC-06: Three isolated repetitions support any capacity statement

## Dependencies

None for the harness. Isolated runtime environment is required for final evidence.

## Risks

Accidental mutation of shared data; external PayPal side effects; mistaking client-side metrics for server saturation.

## Verification Command

```bash
python3 scripts/ai-factory/validate.py
k6 inspect load-tests/k6/neon-arsenal.js
k6 run load-tests/k6/neon-arsenal.js
```

## Expected Evidence

Factory validation exits 0; k6 inspection succeeds; each profile has a JSON summary and synchronized API/PostgreSQL evidence; post-run invariants remain valid.

## Stop Conditions

Stop if the target is not disposable, writes could reach shared data, PayPal capture/webhook-success traffic is requested without approval, or a capacity claim lacks three equivalent runs.

## Traceability

GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY

## Change History

- 2026-09-08 — Migrated to the task artifact contract.
