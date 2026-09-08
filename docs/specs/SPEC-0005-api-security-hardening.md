---
id: SPEC-0005
status: Accepted
version: 1
source_issue: "#58"
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0005] — API security hardening

## Status

`Accepted`

Issue #58 authorizes HTTP-edge and authorization hardening of the existing Express API. This Specification is the contract for that change.

## Problem

The API already authenticates JWT bearers, validates many write bodies with Zod, allowlists CORS, verifies PayPal webhook signatures, and enforces ownership in domain services. The threat model still records missing security headers, an implicit JSON body limit, production CORS that always appends local Vite origins, compiled JWT secret fallbacks that remain usable in production, an unauthenticated listing-reserve route, and no single automated security checklist.

## Goal

Every public HTTP response carries explicit browser-abuse headers. Oversized JSON is rejected with a generic 413. Production CORS is only the configured frontend origins. Production process start refuses default JWT secrets. Unauthenticated clients cannot reserve listings. Clients cannot set listing lifecycle status through the generic PATCH body. Error responses do not leak stacks, raw bodies, tokens, or the rejected Origin. A checklist and automated tests prove these controls and the existing IDOR, privilege, webhook, and validation controls.

## Actors

Untrusted HTTP clients, authenticated CUSTOMER/SELLER/ADMIN, PayPal webhook sender, API process on Render, PostgreSQL.

## Scope

Security headers middleware, explicit JSON body limit and error mapping, production CORS allowlist, production JWT secret assertion at process start, Zod max-length tightening on identifiers and write strings, `validateParams` on admin seller approval, authentication on `POST /listings/:id/reserve`, removal of client-supplied listing `status` from the generic update DTO, generic CORS/JSON/payload error messages, security checklist, and automated security tests.

## Non-goals

Helmet as a new npm dependency. Redis or any shared rate-limit store. New environment variables. PayPal refunds, new PayPal APIs, or changing OrdersCreate/OrdersCapture retry policy. Changing the non-production webhook-id skip used by local tests. AWS Secrets Manager, Terraform, or leaving Render (ADR 0007). Frontend (`src/`) changes. Access-token denylist, 2FA, WAF, CSRF cookies, or webhook IP allowlists.

## Business Rules

- `BR-01`: Every HTTP response includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Permitted-Cross-Domain-Policies: none`, `Permissions-Policy` disabling camera/microphone/geolocation/payment, `Content-Security-Policy: frame-ancestors 'none'`, and `X-DNS-Prefetch-Control: off`. Production also sends `Strict-Transport-Security` with a six-month max-age and `includeSubDomains`.
- `BR-02`: JSON bodies are limited to 100 KiB. Exceeding the limit returns HTTP 413 and the message `Request payload too large.`
- `BR-03`: CORS remains an explicit allowlist of `FRONTEND_URL` (comma-separated) plus, outside production only, the local Vite origins. Requests without `Origin` stay allowed. Rejected origins return HTTP 403 with `Origin not allowed.` and must not echo the Origin value.
- `BR-04`: Write and identifier inputs stay Zod-validated. Resource ids are 1–128 characters. Self-registration cannot choose `ADMIN`.
- `BR-05`: Customers may read or mutate only their own orders and reviews. Sellers may mutate only their own listings and seller profile. Admin routes require role `ADMIN`.
- `BR-06`: `POST /listings/:id/reserve` requires a valid access token. Listing `ACTIVE → RESERVED` for checkout remains `POST /orders`.
- `BR-07`: `PATCH /listings/:id` must not accept a client `status`. Reservation, sale, and cancel stay on their dedicated service paths.
- `BR-08`: PayPal webhook authenticity remains RSA-SHA256 verification as already specified (`INV-PAYMENT-WEBHOOK-AUTHENTIC`). This increment does not change the provider contract.
- `BR-09`: When `NODE_ENV=production`, process start fails if `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing or equals the compiled development fallback. No new env vars.
- `BR-10`: Unhandled errors return `Internal server error.` Invalid JSON returns `Invalid JSON body.` Clients never receive stack traces, raw request bodies, JWT/PayPal secrets, or Prisma internals.

## Invariants

- `INV-AUTH-OWNERSHIP`
- `INV-LISTING-EXCLUSIVE-RESERVE`
- `INV-LISTING-SOLD-IRREVERSIBLE`
- `INV-PAYMENT-WEBHOOK-AUTHENTIC`
- `INV-PAYMENT-TRUSTED-CONFIRM`

## State Transitions

Listing and order lifecycles are unchanged. This Specification forbids clients from driving listing status through the generic update DTO. `POST /listings/:id/reserve` remains a conditional `ACTIVE → RESERVED` write but is no longer anonymous.

```text
ACTIVE → RESERVED  (checkout / authenticated reserve)
RESERVED → SOLD    (trusted payment or ADMIN mark-sold)
RESERVED → ACTIVE  (expiration only)
* → CANCELED       (owner/admin cancel; not SOLD)
```

## API / Data Contract

- Response headers: `BR-01`.
- `express.json` limit `100kb`; 413 on overflow; 400 `Invalid JSON body.` on parse failure.
- CORS: existing methods and headers; production allowlist is configured origins only.
- `POST /listings/:id/reserve`: 401 without a bearer access token.
- `PATCH /listings/:id` body: `price` and `tradeLockUntil` only. A supplied `status` is ignored (Zod strip) and cannot change listing state.
- `PATCH /admin/sellers/:id/approve`: `:id` validated as a resource id.
- Error JSON remains `{ "error": string }` with generic messages in `BR-02`, `BR-03`, and `BR-10`.
- No new routes, env vars, or schema migrations.

## Concurrency Model

No new transactional writes. Existing conditional reservation and ownership checks remain the concurrency controls. Header, CORS, payload, and secret checks are per-request and process-start only.

## Failure Modes

- Oversized body: 413, no parse of the remainder, no body logged.
- Invalid JSON: 400 generic message.
- Disallowed Origin: 403 generic message; browser still hides the response when CORS fails.
- Missing/default JWT secrets in production: process does not listen.
- Unsigned webhook in production: existing verifier returns false; handler does not confirm payment.
- Unauthenticated reserve: 401; listing stays ACTIVE.
- Cross-customer order read: 403; no order payload.

## Security

Trust boundary remains the Express HTTP edge. Bearer tokens stay the session model (no CSRF cookies). Webhook path stays unauthenticated at Express and trusted only after signature verification. Secrets stay in existing environment variables. Logs and error JSON must not include credentials, tokens, PayPal headers, or raw bodies.

## Observability

Existing structured error logs for 5xx and unhandled errors. Do not add request-body or Authorization logging. Security tests are the acceptance evidence.

## Backward Compatibility

Compatible with existing clients that already send JWTs on authenticated routes and that PATCH listings with `price` / `tradeLockUntil` only (current seller UI). Anonymous `POST /listings/:id/reserve` becomes 401. Production deploys that already set `FRONTEND_URL` and generated JWT secrets (Render Blueprint) keep working. A production process without JWT secrets fails closed at start.

## Acceptance Criteria

- [ ] `AC-01` — HTTP responses include the security headers in BR-01. **Evidence:** test
- [ ] `AC-02` — JSON above 100 KiB returns HTTP 413 and `Request payload too large.` **Evidence:** test
- [ ] `AC-03` — An unlisted Origin is rejected; production allowlists do not append hardcoded local Vite origins when `FRONTEND_URL` is set. **Evidence:** test
- [ ] `AC-04` — Register rejects `role=ADMIN`; resource ids longer than 128 characters are rejected. **Evidence:** test
- [ ] `AC-05` — A customer cannot read another customer's order; a non-ADMIN cannot call `/admin`. **Evidence:** integration
- [ ] `AC-06` — `POST /listings/:id/reserve` without a bearer token returns 401. **Evidence:** test
- [ ] `AC-07` — `PATCH /listings/:id` does not apply a client-supplied `status`. **Evidence:** test
- [ ] `AC-08` — PayPal webhook signature verification still rejects missing headers, stale transmission time, and unsigned events in production. **Evidence:** test
- [ ] `AC-09` — Production start throws when JWT secrets are missing or equal the compiled fallbacks. **Evidence:** test
- [ ] `AC-10` — Unhandled errors return `Internal server error.` without a stack; CORS rejection does not echo Origin; invalid JSON returns `Invalid JSON body.` **Evidence:** test
- [ ] `AC-11` — `docs/security/api-hardening-checklist.md` exists and maps each control to an automated test. **Evidence:** static check

### Acceptance rules

1. Criteria must describe observable outcomes, not implementation steps.
2. Criteria must be deterministic enough for an independent verifier to judge.
3. Criteria must cover important failure and security behavior, not only the happy path.
4. A criterion is not accepted because a test passes when the test does not actually prove the criterion.

## Verification Strategy

- Required commands/checks: `cd server && npm run test:unit`; `cd server && npm run test:integration`; `python3 scripts/ai-factory/validate.py`
- Unit tests: headers, payload 413, CORS production allowlist, JWT production assertion, error mapping, reserve 401, listing status strip, register ADMIN, webhook signature cases already present
- Integration/concurrency tests: HTTP IDOR and admin role gate against PostgreSQL
- Security/contract checks: checklist ↔ test map
- Runtime/manual checks: none required beyond the automated suite
- Required external evidence: none (no new PayPal contract)

The final implementation must be traceable from each material acceptance criterion to evidence.

## Decisions / References

- `docs/architecture/threat-model.md` (gaps this increment closes)
- `docs/architecture/domain-invariants.md` (`INV-AUTH-OWNERSHIP`, listing lifecycle, webhook authenticity)
- `docs/adr/0002-paypal-webhook-reliability.md`
- `docs/adr/0007` Render remains production
- Existing env: `FRONTEND_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PAYPAL_WEBHOOK_ID`, `NODE_ENV`

## Traceability

Material changes must preserve this chain:

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

### Traceability metadata

- Issue: `#58`
- Spec: `SPEC-0005`
- Plan: `PLAN-0002`
- Tasks: `TASK-0001`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending
- Memory: pending

When present, `source_issue` uses the canonical GitHub Issue reference format `#<number>` as optional external-tracker metadata.

## Change History

- `v1` — Initial accepted contract for issue #58 — 2026-09-06
