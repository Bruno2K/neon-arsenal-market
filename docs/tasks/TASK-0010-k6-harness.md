---
id: TASK-0010
status: Ready
version: 2
source_issue: "#55"
source_spec: SPEC-0009
source_spec_version: 2
source_plan: PLAN-0006
source_plan_version: 2
baseline_revision: bb829f41e320be915d9633e637071011701e4dc1
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-08
---

# [TASK-0010] — Build and run the k6 capacity harness

## Status

`Ready`

## Source

- Specification: `SPEC-0009` v2
- Plan: `PLAN-0006` v2
- External tracker: #55 (optional)

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

None

## Risks

Accidental mutation of shared data; external PayPal side effects; mistaking client-side metrics for server saturation.

## Verification Command

```bash
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
k6 inspect load-tests/k6/neon-arsenal.js
k6 run load-tests/k6/neon-arsenal.js
```

## Expected Evidence

Documentation contract validation exits 0; k6 inspection succeeds; each profile has a JSON summary and synchronized API/PostgreSQL evidence; post-run invariants remain valid.

## Stop Conditions

Stop if the target is not disposable, writes could reach shared data, PayPal capture/webhook-success traffic is requested without approval, or a capacity claim lacks three equivalent runs.

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

## Change History

- 2026-09-08 — v2 — Migrated dependencies, validation commands, baseline and traceability to the direct-agent documentation contract.
- 2026-09-08 — v1 — Migrated to the task artifact contract.
