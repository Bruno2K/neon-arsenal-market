---
id: PLAN-0002
status: Ready
version: 1
source_spec: SPEC-0005
source_spec_version: 1
baseline_revision: aced10e53c76df40debb25fc5d07c74a0a7b5424
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [PLAN-0002] — API security hardening

## Status

`Ready`

## Source

- Specification: `SPEC-0005` v1
- Issue: `#58`
- Planning task: issue #58 Backend + Reliability + Security + Test + Verification
- Baseline: `aced10e53c76df40debb25fc5d07c74a0a7b5424`

The Plan derives implementation work from the Specification. It may narrow implementation choices but must not add, remove, or reinterpret acceptance criteria.

## Current State

Inspected at the baseline:

- `app.ts` has CORS, `express.json` with `rawBody` and no explicit limit, `apiLimiter`, no security-header middleware.
- `cors.ts` always unions configured origins with `http://localhost:5173` and `http://127.0.0.1:5173`.
- `jwt.ts` falls back to compiled default secrets.
- `paypalWebhook.ts` already verifies RSA-SHA256, cert host allowlist, and 5-minute skew; production requires `PAYPAL_WEBHOOK_ID`.
- Zod `validateBody`/`Params`/`Query` cover most write routes; `PATCH /admin/sellers/:id/approve` lacks `validateParams`.
- Ownership checks exist in orders, listings, reviews, sellers, payments, and commissions services.
- `POST /listings/:id/reserve` has no `authenticate`. `updateListingDto` accepts `status`.
- `errorHandler` maps Prisma unique/not-found; unhandled errors are generic 500; payload-too-large and CORS errors are not specialized.
- Threat model section 6 lists Helmet/headers as absent.
- No `docs/security/` checklist.

## Goal

Close the SPEC-0005 gaps with the smallest server-side change: explicit headers and JSON limit, production CORS and JWT fail-closed start, reserve authentication, listing status stripped from generic PATCH, admin id validation, safe error mapping, checklist, and tests.

## Affected Areas

- `server/src/app.ts` — wire headers and JSON limit
- `server/src/shared/middlewares/securityHeaders.ts` — new
- `server/src/shared/config/http.ts` — JSON limit constant
- `server/src/shared/config/cors.ts` — production allowlist
- `server/src/shared/utils/jwt.ts` and `startApi.ts` — production secret assertion
- `server/src/shared/errors/errorHandler.ts` — 413 / invalid JSON / CORS
- `server/src/modules/listings/listings.routes.ts` and `listings.dto.ts`
- `server/src/modules/admin/admin.routes.ts`
- write DTOs — resource-id and string max lengths
- `docs/security/api-hardening-checklist.md`
- `docs/architecture/threat-model.md`, `current-state.md`, `c4.md`
- unit and integration security tests under `server/src/`

Do not edit `src/`.

## Architecture

Stay in the modular monolith. Headers, CORS, JSON limit, and error mapping belong at the HTTP edge (`shared/`). Ownership and listing lifecycle stay in domain services. No new infrastructure. No ADR: this applies existing threat-model and invariant decisions rather than a new structural trade-off.

## Database

None. No schema or migration.

## Implementation Sequence

1. Add HTTP limit constant, security-header middleware, production CORS, production JWT assertion, and error mapping; wire them in `app.ts` / `startApi.ts`.
2. Authenticate reserve; strip listing `status` from the update DTO; validate admin seller id; add shared id/string max lengths on write DTOs.
3. Write checklist and update threat-model / current-state / C4 to match executable controls.
4. Add unit tests for AC-01–04, AC-06–10 and an integration test for AC-05.
5. Run factory validation, unit tests, and integration tests.

## Task Graph

```text
TASK-0001
```

Single sequential task: the files overlap on `app.ts` and listings/auth edges.

## Testing Strategy

| Criterion | Test |
|---|---|
| AC-01 | HTTP GET `/health` (or isolated middleware) asserts headers |
| AC-02 | POST oversized JSON to a public route → 413 |
| AC-03 | `getAllowedCorsOrigins` production vs non-production; HTTP Origin rejected |
| AC-04 | `registerDto` ADMIN; resource id max |
| AC-05 | PostgreSQL HTTP: customer GET foreign order 403; CUSTOMER `/admin` 403 |
| AC-06 | POST `/listings/:id/reserve` without bearer → 401 |
| AC-07 | `updateListingDto.parse` strips `status`; service still rejects illegal transitions |
| AC-08 | Existing `paypalWebhook.test.ts` |
| AC-09 | `assertProductionJwtSecrets` throws on missing/default in production |
| AC-10 | `errorHandler` unit tests |
| AC-11 | checklist file present; factory validate |

## Verification Strategy

Independent verifier runs:

1. `python3 scripts/ai-factory/validate.py`
2. `cd server && npm run test:unit`
3. `cd server && npm run test:integration`

PostgreSQL is required for step 3. No PayPal credentials. No browser.

## Risks

- CORS production change: a production API that relied on hardcoded localhost while `FRONTEND_URL` pointed at the real frontend loses laptop-browser access. That is the intended close of T13. Detection: CORS unit tests.
- Reserve 401: unused frontend helper `reserveListing` would need a token if later called. Residual: authenticated customers can still call reserve without creating an order (inventory hold without `reservedByOrderId`). Follow-up, not this SPEC.
- JWT production assertion: a misconfigured Render process fails to listen instead of forging sessions. Detection: start-up unit test.

## Dependencies

- `SPEC-0005` v1 Accepted
- Existing `FRONTEND_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- ADR 0007 Render; ADR 0002 webhook verification

## Stop Conditions

- Request to add Redis, Helmet-as-WAF, new env vars, or PayPal contract changes
- Evidence that seller UI depends on PATCH listing `status` (baseline seller UI sends only price/tradeLockUntil)
- Destructive secret rotation in a live environment

## Definition of Done

All SPEC-0005 acceptance criteria have mapped tests or static evidence. Unit and integration commands have been executed. Threat model no longer claims headers are absent. Diff is limited to `server/` and the listed docs. Handoff completed.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `#58`
- Specification: `SPEC-0005` v1
- Plan: `PLAN-0002` v1
- Tasks: `TASK-0001`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready plan for SPEC-0005 — 2026-09-06
