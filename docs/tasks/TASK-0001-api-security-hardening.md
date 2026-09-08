---
id: TASK-0001
status: Ready
version: 1
source_issue: "#58"
source_spec: SPEC-0005
source_spec_version: 1
source_plan: PLAN-0002
source_plan_version: 1
baseline_revision: aced10e53c76df40debb25fc5d07c74a0a7b5424
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-08
---

# [TASK-0001] — Implement API security hardening

## Status

`Ready`

## Source

- Specification: `SPEC-0005`
- Plan: `PLAN-0002`
- Issue: #58

## Objective

Implement SPEC-0005 on the Express API: security headers, JSON limit, production CORS and JWT fail-closed start, reserve authentication, listing status strip, admin id validation, safe error mapping, checklist, and automated tests.

## Scope

`server/src/app.ts`, shared HTTP/CORS/JWT/error/middleware modules, listings and admin routes/DTOs, write-DTO max lengths, `docs/security/api-hardening-checklist.md`, threat-model/current-state/C4 updates, unit and integration security tests.

Unrelated cleanup, `src/`, schema, and new dependencies are out of scope.

## Allowed Files

Only the paths named in Scope, plus tests and documentation required to prove the listed acceptance criteria.

## Preconditions

Worktree from `origin/main` at PLAN-0002 `baseline_revision`. `SPEC-0005` Accepted. PostgreSQL available for integration tests.

## Acceptance Criteria

- [ ] `AC-01`: Security headers present on HTTP responses **Evidence:** test
- [ ] AC-02: Oversized JSON returns 413
- [ ] AC-03: Explicit CORS; production does not append local Vite origins
- [ ] AC-04: ADMIN cannot self-register; resource ids are length-limited
- [ ] AC-05: Cross-customer order read and non-admin `/admin` are 403
- [ ] AC-06: Anonymous reserve is 401
- [ ] AC-07: Listing PATCH ignores client `status`
- [ ] AC-08: Existing webhook signature tests still pass
- [ ] AC-09: Production start refuses default JWT secrets
- [ ] AC-10: Error handler hides stacks and Origin
- [ ] AC-11: Checklist maps controls to tests

## Dependencies

None.

## Risks

Authenticated reserve without an order remains possible. Production CORS tightens laptop access to a public API.

## Verification Command

```bash
python3 scripts/ai-factory/validate.py
cd server && npm run test:unit
cd server && npm run test:integration
```

## Expected Evidence

Commands exit 0. Tests named in PLAN-0002 cover AC-01–AC-10. Checklist file exists.

## Stop Conditions

Stop if a schema change, new dependency, frontend change, or unplanned payment contract change is required.

## Traceability

GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY

## Change History

- 2026-09-08 — Migrated to the task artifact contract.
