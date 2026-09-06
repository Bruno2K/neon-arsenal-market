# [TASK-0007] — Mount /api/v1 and document compatibility

## Source

- Specification: `SPEC-0007`
- Plan: `PLAN-0004`
- Issue: #60

## Objective

Mount the existing domain routers at `/api/v1`, keep unversioned aliases, update OpenAPI/README/policy docs, and add unit tests that prove SPEC-0007.

## Scope

`server/src/app.ts`, `server/src/shared/http/apiVersion.ts`, `server/src/shared/docs/openapi.ts`, `server/src/__tests__/api.versioning.test.ts`, `docs/architecture/api-versioning.md`, ADR 0017, README, current-state, C4, runbook.

Unrelated cleanup, `src/`, schema, new env vars, and PayPal contract changes are out of scope.

## Preconditions

Worktree from `origin/main` at PLAN-0004 `baseline_revision`. `SPEC-0007` Accepted.

## Acceptance Criteria

- [ ] AC-01: `/api/v1` domain routes match unversioned status/error contract
- [ ] AC-02: Unversioned domain paths still respond
- [ ] AC-03: Health/docs remain host-rooted; `/api/v1/health` is not required
- [ ] AC-04: OpenAPI servers document `/api/v1`
- [ ] AC-05: Policy + README describe compatibility / breaking / deprecation / migration
- [ ] AC-06: Unknown version prefix is generic 404
- [ ] AC-07: Security headers, CORS, and JSON errors apply on `/api/v1`
- [ ] AC-08: No new env vars, PayPal APIs, or business endpoints

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
