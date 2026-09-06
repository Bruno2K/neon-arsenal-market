# [TASK-0008] — Operational dashboard definitions

## Source

- Specification: `SPEC-0008`
- Plan: `PLAN-0005`
- Issue: #62

## Objective

Publish operator dashboards for API, Orders, Payments, webhooks, reconciliation, and database that map to meters, labels, and spans already in `server/src/shared/observability/`.

## Scope

`docs/operations/dashboards.md`, `docs/operations/dashboards/neon-arsenal-api.json`, span list update in `docs/observability.md`.

Out of scope: Grafana/Prometheus server, new instruments, `src/`, payment semantics.

## Preconditions

Worktree from `origin/main` at PLAN-0005 `baseline_revision`. `SPEC-0008` Accepted.

## Acceptance Criteria

- [ ] AC-01: Six dashboard groups exist and cite only existing instruments
- [ ] AC-02: JSON catalog lists every meter name, type, unit, and allowed attributes
- [ ] AC-03: Critical traces and `app.outcome` values are named
- [ ] AC-04: Dual `http.route` prefixes (`/` and `/api/v1`) are documented

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
