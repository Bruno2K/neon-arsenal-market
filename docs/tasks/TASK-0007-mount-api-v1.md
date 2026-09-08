---
id: TASK-0007
status: Done
version: 1
source_issue: "#60"
source_spec: SPEC-0007
source_spec_version: 1
source_plan: PLAN-0004
source_plan_version: 1
baseline_revision: 87c32bcbace9ccb5af579e856e6d554a1e85024b
owner: Neon Arsenal Engineering
created: 2026-09-06
updated: 2026-09-06
---

# [TASK-0007] — Mount /api/v1 and document compatibility

## Status

`Done`.

## Source

- Specification: `SPEC-0007`
- Plan: `PLAN-0004`
- Issue: #60

## Objective

Mount the existing domain routers at `/api/v1`, keep unversioned aliases, update OpenAPI/README/policy docs, and add unit tests that prove SPEC-0007.

## Scope

`server/src/app.ts`, `server/src/shared/http/apiVersion.ts`, `server/src/shared/docs/openapi.ts`, `server/src/__tests__/api.versioning.test.ts`, `docs/architecture/api-versioning.md`, ADR 0017, README, current-state, C4, runbook.

Unrelated cleanup, `src/`, schema, new env vars, and PayPal contract changes are out of scope.

## Allowed Files

- `server/src/app.ts`
- `server/src/shared/http/apiVersion.ts`
- `server/src/shared/docs/openapi.ts`
- `server/src/__tests__/api.versioning.test.ts`
- `docs/architecture/**`
- `docs/adr/**`
- `docs/runbook.md`
- `README.md`

## Preconditions

Worktree from `origin/main` at PLAN-0004 `baseline_revision`. `SPEC-0007` Accepted.

## Acceptance Criteria

- [x] `AC-01` `/api/v1` domain routes match unversioned status/error contract. **Evidence:** test
- [x] `AC-02` Unversioned domain paths still respond. **Evidence:** test
- [x] `AC-03` Health/docs remain host-rooted; `/api/v1/health` is not required. **Evidence:** test
- [x] `AC-04` OpenAPI servers document `/api/v1`. **Evidence:** test
- [x] `AC-05` Policy + README describe compatibility, breaking, deprecation, and migration. **Evidence:** manual review
- [x] `AC-06` Unknown version prefix is generic 404. **Evidence:** test
- [x] `AC-07` Security headers, CORS, and JSON errors apply on `/api/v1`. **Evidence:** test
- [x] `AC-08` No new env vars, PayPal APIs, or business endpoints. **Evidence:** static check

## Dependencies

None.

## Risks

Dual Express Router mount must share `authLimiter`. Do not copy payment handlers.

## Verification Command

```bash
python3 scripts/ai-factory/validate.py
cd server && npm run test:unit
```

## Expected Evidence

Commands exit 0. Versioning unit tests cover AC-01–AC-04, AC-06, AC-07. Policy and README exist.

## Stop Conditions

- Stop if versioned routing changes business or PayPal behavior.
- Stop before editing schema, client files, new environment variables, or files outside `Allowed Files`.

## Traceability

`GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-06 — v1 — API-versioning Task completed.
