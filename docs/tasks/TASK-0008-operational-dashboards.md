---
id: TASK-0008
status: Done
version: 1
source_issue: "#62"
source_spec: SPEC-0008
source_spec_version: 1
source_plan: PLAN-0005
source_plan_version: 1
baseline_revision: 27c94eb46d24353aee866852236c83134a89702e
owner: Neon Arsenal Engineering
created: 2026-09-06
updated: 2026-09-06
---

# [TASK-0008] — Operational dashboard definitions

## Status

`Done`.

## Source

- Specification: `SPEC-0008`
- Plan: `PLAN-0005`
- Issue: #62

## Objective

Publish operator dashboards for API, Orders, Payments, webhooks, reconciliation, and database that map to meters, labels, and spans already in `server/src/shared/observability/`.

## Scope

`docs/operations/dashboards.md`, `docs/operations/dashboards/neon-arsenal-api.json`, span list update in `docs/observability.md`.

Out of scope: Grafana/Prometheus server, new instruments, `src/`, payment semantics.

## Allowed Files

- `docs/operations/dashboards.md`
- `docs/operations/dashboards/neon-arsenal-api.json`
- `docs/observability.md`

## Preconditions

Worktree from `origin/main` at PLAN-0005 `baseline_revision`. `SPEC-0008` Accepted.

## Acceptance Criteria

- [x] `AC-01` Six dashboard groups exist and cite only existing instruments. **Evidence:** static check
- [x] `AC-02` JSON catalog lists every meter name, type, unit, and allowed attributes. **Evidence:** static check
- [x] `AC-03` Critical traces and `app.outcome` values are named. **Evidence:** static check
- [x] `AC-04` Dual `http.route` prefixes (`/` and `/api/v1`) are documented. **Evidence:** manual review

## Dependencies

None.

## Risks

Omitting `/api/v1` routes would under-count SLI traffic.

## Verification Command

```bash
python3 scripts/ai-factory/validate.py
```

## Expected Evidence

Dashboard markdown and JSON exist. Factory validation passes after TASK-0009 artifacts land.

## Stop Conditions

- Stop if documentation requires an instrument that does not exist.
- Stop before adding runtime infrastructure, payment changes, or files outside `Allowed Files`.

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-06 — v1 — Operational-dashboard Task completed.
