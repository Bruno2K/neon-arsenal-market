---
id: TASK-0010
status: Done
version: 4
source_issue: "#55"
source_spec: SPEC-0009
source_spec_version: 4
source_plan: PLAN-0006
source_plan_version: 4
baseline_revision: 9f4c60885d8a1c9c11362d1b236c6179b7f787e9
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-10
---

# [TASK-0010] — Build and run the k6 capacity harness

## Status

`Done`

## Source

- Specification: `SPEC-0009` v4
- Plan: `PLAN-0006` v4
- External tracker: #55 (optional)

## Objective

Enable a no-cloud-credential controlled CI environment that produces safe, correlated capacity evidence for all five profiles.

## Scope

`load-tests/k6/`, `docs/performance/`, and SPEC/PLAN/TASK traceability. No application runtime, schema, deploy or provider-contract change.

## Allowed Files

`load-tests/k6/`, `docs/performance/`, `.github/workflows/load-test.yml`, catalog evidence workflow, and the directly related SPEC/PLAN/TASK artifacts. Stop for runtime, schema, deploy or provider-contract changes.

## Preconditions

`SPEC-0009` Accepted; `PLAN-0006` Ready. Runtime phase uses GitHub Actions with Docker support and only disposable local credentials/data.

## Acceptance Criteria

- [x] `AC-01` — Production Docker image and PostgreSQL 16 run with explicit recorded resource limits. **Evidence:** runtime
- [x] `AC-02` — All five profiles are manually dispatchable; only orders receives write opt-in and disposable unique listings. **Evidence:** static check
- [x] `AC-03` — Payment replay is prepared locally and cannot reach PayPal; webhook verification remains intact. **Evidence:** manual review
- [x] `AC-04` — Raw k6, API, resource, PostgreSQL and invariant evidence is retained for the same UTC window. **Evidence:** runtime
- [x] `AC-05` — Repeated claim evidence preserves the same commit/configuration and exact frozen API image with a fresh equivalent dataset. **Evidence:** runtime
- [x] `AC-06` — Successful controlled runs cover all profiles and three equivalent repetitions support the committed controlled-CI catalog capacity statement. **Evidence:** runtime

## Dependencies

None

## Risks

Accidental mutation of shared data; external PayPal side effects; mistaking client-side metrics for server saturation; GitHub-hosted runner variability.

## Verification Command

```bash
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
k6 inspect load-tests/k6/neon-arsenal.js
k6 run load-tests/k6/neon-arsenal.js
```

## Expected Evidence

Satisfied. The repository has successful controlled runs for smoke, webhook rejection, orders and payment replay, plus final catalog workflow run `34439840030` with three equivalent repetitions using the same frozen API image. The catalog report correlates k6 with API/PostgreSQL resource signals and invariant proof.

## Stop Conditions

Stop if the target is not disposable, writes could reach shared data, PayPal capture/webhook-success traffic is requested without approval, or a capacity claim lacks three equivalent runs.

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

- Implementation/qualification PRs: `#229`–`#239`
- Smoke: `34401063625`
- Webhook rejection: `34403607329`
- Orders: `34418517461`
- Payment replay: `34420854485`
- Catalog final evidence: `34439840030`
- Report: `docs/performance/load-test-report-2026-09-10-catalog.md`

## Change History

- 2026-09-10 — v4 — Marked Done after all profiles produced controlled evidence and the catalog claim passed three equivalent frozen-image repetitions with correlated resource/invariant artifacts.
- 2026-09-09 — v3 — Started controlled CI capacity-evidence enablement; runtime evidence and AC-07 remained pending.
- 2026-09-08 — v2 — Migrated dependencies, validation commands, baseline and traceability to the direct-agent documentation contract.
- 2026-09-08 — v1 — Migrated to the task artifact contract.
