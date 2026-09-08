---
id: PLAN-0004
status: Ready
version: 1
source_spec: SPEC-0007
source_spec_version: 1
baseline_revision: 87c32bcbace9ccb5af579e856e6d554a1e85024b
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [PLAN-0004] — API versioning and compatibility policy

## Status

`Ready`

## Source

- Specification: `SPEC-0007` v1
- Issue: `#60`
- Planning task: issue #60 Planner → implementation → Verification
- Baseline: `87c32bcbace9ccb5af579e856e6d554a1e85024b`

The Plan derives implementation work from the Specification. It may narrow implementation choices but must not add, remove, or reinterpret acceptance criteria.

## Current State

Inspected at the baseline:

- `server/src/app.ts` mounts domain routers at `/auth`, `/users`, `/sellers`, `/products`, `/listings`, `/orders`, `/payments`, `/commissions`, `/reviews`, `/admin`. `authLimiter` wraps only `/auth`.
- `healthRoutes` and `docsRoutes` are host-rooted (`/health`, `/ready`, `/docs`, `/docs/json`).
- No `/api` or `/api/v1` prefix exists in the repository (search at baseline).
- OpenAPI `servers` are `http://localhost:3001` and `https://api.neonarsenal.com`; path keys are unversioned (`/auth/login`, `/listings`, …).
- Storefront `src/api/*` calls unversioned paths. This Plan does not edit `src/`.
- Runbook documents PayPal at `POST /payments/webhook`. ADR 0007 keeps Render `healthCheckPath: /ready`.
- CORS, `securityHeaders`, JSON 100kb limit, and `apiLimiter` are app-wide middleware (already apply to any new prefix).

## Goal

Mount the same domain routers at `/api/v1`, keep unversioned aliases, document the compatibility policy, and update OpenAPI, README, and unit tests so SPEC-0007 acceptance criteria are observable.

## Affected Areas

- `server/src/app.ts` — dual-mount domain routers (composition root)
- `server/src/shared/http/apiVersion.ts` — prefix constant only (no module imports)
- `server/src/shared/docs/openapi.ts` — servers and description
- `server/src/__tests__/api.versioning.test.ts` — HTTP dual-prefix tests
- `docs/architecture/api-versioning.md`, ADR 0017, SPEC-0007 (already the contract)
- `README.md`, `docs/architecture/current-state.md`, `docs/architecture/c4.md`, `docs/operations/runbook.md` — path documentation
- Do not edit `src/`. No schema, no new env vars, no PayPal contract change.

## Architecture

Stay in the modular monolith. Versioning is an HTTP mount in `app.ts`. Shared code must not import `modules/` (ADR 0016). A prefix constant may live under `shared/http/`. Same routers, same services, same PostgreSQL.

## Database

None. No schema or migration.

## Implementation Sequence

1. Accept `SPEC-0007` and mark this Plan Ready against baseline `87c32bcbace9ccb5af579e856e6d554a1e85024b`.
2. Export `API_V1_PREFIX`. In `app.ts`, mount the existing domain routers on a shared `Router` at `/` and `/api/v1`.
3. Point OpenAPI default servers at `/api/v1`; keep health/ready operation servers host-rooted.
4. Link README, current-state, C4, and runbook to the policy. Do not change the registered PayPal URL requirement.
5. Add unit tests for AC-01–AC-04, AC-06, AC-07.
6. Run factory validation and `npm run test:unit`.

## Task Graph

```text
TASK-0007
```

Single sequential task: `app.ts`, OpenAPI, docs, and tests overlap on the same mount.

## Testing Strategy

| Criterion | Test |
|---|---|
| AC-01 | `GET /api/v1/auth/me` and `POST /api/v1/auth/login` (invalid JSON) match unversioned status/body |
| AC-02 | `GET /auth/me` still 401; unversioned `/docs/json` still 200 |
| AC-03 | `GET /health` and `GET /docs/json` 200; `GET /api/v1/health` is 404 |
| AC-04 | `openApiSpec.servers` include `/api/v1`; `/docs/json` reflects that |
| AC-05 | Policy file and README section exist (static) |
| AC-06 | `GET /api/v2/listings` and `GET /api` return generic 404 |
| AC-07 | Security headers and CORS rejection on `/api/v1/auth/me`; invalid JSON 400 on `/api/v1/auth/login` |
| AC-08 | Diff review: no new env, PayPal, or business routes |

`GET /auth/me` is 401 without a bearer and does not need PostgreSQL.

## Verification Strategy

Independent verifier runs:

1. `python3 scripts/ai-factory/validate.py`
2. `cd server && npm run test:unit`

No PostgreSQL required. No PayPal credentials. No browser. Do not edit `src/`.

## Risks

- Dual-mount of one Router instance is the intended Express pattern; if a framework quirk appeared, fall back to calling `app.use` twice with the same route modules (already imported).
- Storefront stays on unversioned paths. Residual: clients that hardcode OpenAPI Try-it-out against `/api/v1/health` get 404 — health stays unversioned by BR-04.
- PayPal Dashboard URL is unchanged. Residual: an operator who points PayPal only at a non-existent path would drop webhooks; this change does not rewrite that URL.

## Dependencies

- `SPEC-0007` v1 Accepted
- ADR 0007 Render `/ready`
- ADR 0002 webhook verification
- ADR 0016 composition root may import module routes

## Stop Conditions

- Request to hard-cut unversioned paths in the same change
- Request to change PayPal webhook semantics, OrdersCreate/OrdersCapture retry, or add env vars
- Request to edit `src/` or add `/api/v2` handlers
- Evidence that dual-mount would weaken `authLimiter` or CORS

## Definition of Done

All SPEC-0007 acceptance criteria have mapped tests or static/diff evidence. Unit tests and factory validation have been executed. Diff is limited to `server/` and the listed docs. Handoff completed.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `#60`
- Specification: `SPEC-0007` v1
- Plan: `PLAN-0004` v1
- Tasks: `TASK-0007`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready plan for SPEC-0007 — 2026-09-06
