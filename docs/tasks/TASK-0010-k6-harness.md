---
id: TASK-0010
status: InProgress
version: 3
source_issue: "#55"
source_spec: SPEC-0009
source_spec_version: 3
source_plan: PLAN-0006
source_plan_version: 3
baseline_revision: 9f4c60885d8a1c9c11362d1b236c6179b7f787e9
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-09
---

# [TASK-0010] — Build and run the k6 capacity harness

## Status

`Ready`

## Source

- Specification: `SPEC-0009` v3
- Plan: `PLAN-0006` v3
- External tracker: #55 (optional)

## Objective

Enable a no-cloud-credential controlled CI environment that can later produce safe, correlated capacity evidence for all five profiles.

## Scope

`load-tests/k6/`, `docs/performance/`, and SPEC/PLAN/TASK traceability. No application runtime, schema, deploy or provider-contract change.

## Allowed Files

`load-tests/k6/`, `docs/performance/`, `.github/workflows/load-test.yml`, and the directly related SPEC/PLAN/TASK artifacts. Stop for runtime, schema, deploy or provider-contract changes.

## Preconditions

`SPEC-0009` Accepted; `PLAN-0006` Ready. Runtime phase requires GitHub Actions with Docker support; it uses only disposable local credentials and data.

## Acceptance Criteria

- [ ] `AC-01` — Production Docker image and PostgreSQL 16 run with explicit recorded resource limits. **Evidence:** static check
- [ ] `AC-02` — All five profiles are manually dispatchable; only orders receives write opt-in and disposable unique listings. **Evidence:** static check
- [ ] `AC-03` — Payment replay is prepared locally and cannot reach PayPal; webhook verification remains intact. **Evidence:** manual review
- [ ] `AC-04` — Raw k6, API, resource, PostgreSQL and invariant evidence is retained for the same UTC window. **Evidence:** static check
- [ ] `AC-05` — One/three repetition modes preserve the same commit and configuration with a fresh equivalent dataset. **Evidence:** static check
- [ ] `AC-06` — Subsequent successful runs cover all profiles and three repetitions support any controlled CI capacity statement. **Evidence:** runtime

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

Enablement validation exits 0 and the workflow is statically valid. Subsequent workflow execution supplies per-profile JSON, synchronized API/PostgreSQL evidence and post-run invariant proof. AC-07 remains open until those runs exist.

## Stop Conditions

Stop if the target is not disposable, writes could reach shared data, PayPal capture/webhook-success traffic is requested without approval, or a capacity claim lacks three equivalent runs.

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

## Change History

- 2026-09-09 — v3 — Started controlled CI capacity-evidence enablement; runtime evidence and AC-07 remain pending.
- 2026-09-08 — v2 — Migrated dependencies, validation commands, baseline and traceability to the direct-agent documentation contract.
- 2026-09-08 — v1 — Migrated to the task artifact contract.
