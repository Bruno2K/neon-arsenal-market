---
id: TASK-0001
status: Done
version: 1
source_issue: "#58"
source_spec: SPEC-0005
source_spec_version: 1
source_plan: PLAN-0002
source_plan_version: 1
baseline_revision: aced10e53c76df40debb25fc5d07c74a0a7b5424
owner: Neon Arsenal Engineering
created: 2026-09-06
updated: 2026-09-06
---

# [TASK-0001] — Implement API security hardening

## Status

`Done`.

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

- `server/src/**`
- `docs/security/api-hardening-checklist.md`
- `docs/architecture/**`
- `docs/templates/**`
- `docs/specs/**`
- `docs/plans/**`
- `docs/tasks/**`
- `scripts/ai-factory/**`

## Preconditions

Worktree from `origin/main` at PLAN-0002 `baseline_revision`. `SPEC-0005` Accepted. PostgreSQL available for integration tests.

## Acceptance Criteria

- [x] `AC-01` Security headers present on HTTP responses. **Evidence:** test
- [x] `AC-02` Oversized JSON returns 413. **Evidence:** test
- [x] `AC-03` Explicit CORS; production does not append local Vite origins. **Evidence:** test
- [x] `AC-04` ADMIN cannot self-register; resource ids are length-limited. **Evidence:** test
- [x] `AC-05` Cross-customer order read and non-admin `/admin` are 403. **Evidence:** integration
- [x] `AC-06` Anonymous reserve is 401. **Evidence:** integration
- [x] `AC-07` Listing PATCH ignores client `status`. **Evidence:** test
- [x] `AC-08` Existing webhook signature tests still pass. **Evidence:** test
- [x] `AC-09` Production start refuses default JWT secrets. **Evidence:** test
- [x] `AC-10` Error handler hides stacks and Origin. **Evidence:** test
- [x] `AC-11` Checklist maps controls to tests. **Evidence:** static check

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

- Stop on a conflict with SPEC-0005, PLAN-0002, or an accepted security invariant.
- Stop before changing schema, client files, dependencies, or files outside `Allowed Files`.

## Traceability

`GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-06 — v1 — Security hardening Task completed.
