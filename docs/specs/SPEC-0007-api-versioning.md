---
id: SPEC-0007
status: Accepted
version: 1
source_issue: "#60"
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0007] — API versioning and compatibility policy

## Status

`Accepted`

Issue #60 authorizes a versioned public HTTP prefix and a written compatibility policy. This Specification is the contract for that change.

## Problem

The Express API mounts domain routes at unversioned paths (`/auth`, `/listings`, `/orders`, `/payments`, …). Clients, OpenAPI, and the README treat that surface as implicit v1. There is no `/api/v1` prefix, no documented rule for additive versus breaking changes, and no deprecation or migration path. Future contract changes cannot be introduced without silently breaking existing callers.

## Goal

Public domain endpoints are reachable at `/api/v1/...` with the same handlers, authentication, authorization, CORS, rate limits, and payloads as today. Unversioned domain paths remain working compatibility aliases of v1. OpenAPI, README, and a durable policy document state how backward-compatible changes, breaking changes, deprecation, and client migrations work. Automated tests prove both prefixes.

## Actors

HTTP clients (storefront, curl, future integrators), PayPal webhook sender, Render health probes, Docker liveness probe, API process.

## Scope

- URI-prefix versioning for domain module routes already mounted in `server/src/app.ts`.
- Keep unversioned domain paths as aliases of the same v1 routers.
- Leave `/health`, `/ready`, `/docs`, and `/docs/json` unversioned (operational, not a versioned business contract).
- Document compatibility, breaking changes, deprecation, and migrations.
- Update OpenAPI servers/description, README, current-architecture notes, and unit tests.

## Non-goals

- Hard-cutting or removing unversioned paths in this change.
- Header-based or media-type versioning (`Accept-Version`, `application/vnd.*`).
- A second implementation of any business endpoint, a second PayPal contract, or new environment variables.
- Changing reservation, order, payment, webhook, or money semantics.
- Frontend (`src/`) migration onto `/api/v1`.
- `/api/v2` handlers, sunset dates, or rewriting PayPal Dashboard webhook URLs.
- Redis, Kafka, RabbitMQ, SQS, microservices, AWS, or Terraform.

## Business Rules

- `BR-01`: The current public API version is `v1`. Its URL prefix is `/api/v1`.
- `BR-02`: Every domain route mounted today (`/auth`, `/users`, `/sellers`, `/products`, `/listings`, `/orders`, `/payments`, `/commissions`, `/reviews`, `/admin`) is also mounted under `/api/v1` using the **same routers and middleware**.
- `BR-03`: Unversioned domain paths remain supported aliases of v1. They must not diverge in auth, validation, status codes, or payload shape.
- `BR-04`: `/health`, `/ready`, `/docs`, and `/docs/json` stay at the host root. They are operational, not versioned public resources. Render continues to probe `GET /ready`.
- `BR-05`: Additive, backward-compatible changes may land on v1 (new optional request fields, new response fields that existing clients can ignore, new endpoints under `/api/v1`, new optional query parameters, relaxed validation).
- `BR-06`: A breaking change to an existing v1 contract requires a new major prefix (`/api/v2` or later) authorized by a later Accepted Specification. v1 must not silently change meaning.
- `BR-07`: Breaking changes include: removing or renaming a URL, field, header, or enum value clients already send or receive; changing a field type or meaning; changing a success or error status code for an existing request; adding a required request field or header; tightening authentication or authorization so a previously valid call fails; changing the default pagination response shape.
- `BR-08`: Deprecation of an unversioned alias or of a v1 field/endpoint must be announced in OpenAPI and `docs/architecture/api-versioning.md` before removal. This Specification does not retire any path.
- `BR-09`: PayPal webhook authenticity and confirmation rules are unchanged (`INV-PAYMENT-WEBHOOK-AUTHENTIC`, `INV-PAYMENT-TRUSTED-CONFIRM`). `POST /payments/webhook` keeps working. `POST /api/v1/payments/webhook` accepts the same signed events. This issue does not change the registered PayPal webhook URL or invent webhook env vars.
- `BR-10`: CORS, security headers, JSON body limit, `apiLimiter`, and `authLimiter` apply equally to both prefixes. Clients cannot bypass rate limits or auth by switching prefix.
- `BR-11`: Unknown version prefixes (`/api/v2`, `/api`) return the existing generic 404. Do not invent a version-negotiation protocol.

## Invariants

- `INV-AUTH-OWNERSHIP`
- `INV-PAYMENT-WEBHOOK-AUTHENTIC`
- `INV-PAYMENT-TRUSTED-CONFIRM`
- `INV-LISTING-EXCLUSIVE-RESERVE`
- `INV-ORDER-IDEMPOTENCY`

No invariant statement changes. Versioning is an HTTP mounting concern.

## State Transitions

Listing, order, and payment lifecycles are unchanged.

```text
ACTIVE → RESERVED → SOLD
             ↓
           ACTIVE
       ↘ CANCELED

PENDING → CONFIRMED → SHIPPED → DELIVERED
       ↘ CANCELLED ↙
```

## API / Data Contract

- Current documented base: `{origin}/api/v1`.
- Compatibility aliases: `{origin}/auth`, `{origin}/listings`, … (same resources, no `/api` prefix).
- Operational: `GET /health`, `GET /ready`, `GET /docs`, `GET /docs/json`.
- OpenAPI `servers` list `/api/v1` as the current public contract. Health/ready operations stay host-rooted.
- No new business fields, routes, or env vars.
- Error JSON remains `{ "error": string }` (and existing `statusCode` where already returned).

## Concurrency Model

No new writes. Existing conditional reservation, order idempotency, and webhook event uniqueness remain the concurrency controls. Dual mounts share the same service and PostgreSQL state.

## Failure Modes

- Request to `/api/v1/<existing-resource>`: same success and error outcomes as the unversioned path.
- Request to `/api/v2/...` or `/api`: existing 404, no stack leak.
- PayPal still delivers to the registered unversioned webhook URL; a future operator may point PayPal at `/api/v1/payments/webhook` without a code change.
- Process crash, retries, and webhook duplicates are unchanged.

## Security

Trust boundary remains the Express HTTP edge. Dual mounting must not weaken JWT authentication, ownership checks, CORS allowlisting, JSON limits, security headers, or auth rate limits. Webhook path stays unauthenticated at Express and trusted only after existing RSA-SHA256 verification. No new secrets.

## Observability

Existing request IDs, HTTP spans, and route names continue to apply. Do not log tokens, PayPal headers, or raw bodies. Version prefix is visible in the URL already recorded by HTTP telemetry.

## Backward Compatibility

Unversioned domain paths keep working so the current storefront (`src/api/*` uses `/listings`, `/auth`, `/payments`, …) and the currently registered PayPal webhook URL do not break. OpenAPI documents v1 as the current contract. Retirement of aliases requires a later Specification.

## Acceptance Criteria

- [ ] `AC-01` — Domain routes respond on `/api/v1/...` with the same status and error contract as the matching unversioned path. **Evidence:** test
- [ ] `AC-02` — Unversioned domain paths continue to respond (compatibility aliases). **Evidence:** test
- [ ] `AC-03` — `GET /health`, `GET /ready` (when exercised), `GET /docs`, and `GET /docs/json` remain at the host root and are not required under `/api/v1`. **Evidence:** test
- [ ] `AC-04` — OpenAPI documents `/api/v1` as the current public server/base. **Evidence:** test
- [ ] `AC-05` — README and `docs/architecture/api-versioning.md` describe backward-compatible changes, breaking changes, deprecation, and client migration. **Evidence:** static check
- [ ] `AC-06` — An unknown version prefix returns the existing generic 404 without leaking internals. **Evidence:** test
- [ ] `AC-07` — Security headers, CORS rejection, JSON 413/400 mapping, and auth protection still apply on `/api/v1` the same way as on unversioned paths. **Evidence:** test
- [ ] `AC-08` — No new environment variables, PayPal APIs, or business endpoints are introduced. **Evidence:** manual review

### Acceptance rules

1. Criteria must describe observable outcomes, not implementation steps.
2. Criteria must be deterministic enough for an independent verifier to judge.
3. Criteria must cover important failure and security behavior, not only the happy path.
4. A criterion is not accepted because a test passes when the test does not actually prove the criterion.

## Verification Strategy

- Required commands/checks: `cd server && npm run test:unit`; `python3 scripts/ai-factory/validate.py`
- Unit tests: dual-prefix auth/me and invalid-JSON login; OpenAPI servers; health/docs stay unversioned; unknown `/api/v2` is 404; security headers and CORS on `/api/v1`
- Integration/concurrency tests: not required (no state-machine or schema change)
- Security/contract checks: dual-prefix inherits existing edge middleware
- Runtime/manual checks: none required
- Required external evidence: none

The final implementation must be traceable from each material acceptance criterion to evidence.

## Decisions / References

- ADR 0017 — URI path versioning with unversioned v1 aliases
- `docs/architecture/api-versioning.md` — compatibility policy
- `docs/adr/0007-cloud-target-render.md` — `/ready` remains the Render probe
- `docs/adr/0002-paypal-webhook-reliability.md` — webhook authenticity unchanged
- `docs/adr/0016-modular-monolith-boundaries.md` — mounting stays in `app.ts`

## Traceability

Material changes must preserve this chain:

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

### Traceability metadata

- Issue: `#60`
- Spec: `SPEC-0007`
- Plan: `PLAN-0004`
- Tasks: `TASK-0007`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending
- Memory: pending

When present, `source_issue` uses the canonical GitHub Issue reference format `#<number>` as optional external-tracker metadata.

## Change History

- `v1` — Initial accepted contract for issue #60 — 2026-09-06
