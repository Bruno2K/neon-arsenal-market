# API versioning and compatibility policy

Authoritative contract: `SPEC-0007`. Decision: [ADR 0017](../adr/0017-api-url-versioning.md).

This document is the compatibility policy for the Neon Arsenal Market HTTP API. It does not change reservation, payment, or money invariants.

## Current version

| Item | Value |
|---|---|
| Current public version | `v1` |
| Versioned base | `{origin}/api/v1` |
| Compatibility aliases | unversioned domain paths (`/auth`, `/listings`, `/orders`, `/payments`, …) |
| Operational (unversioned) | `GET /health`, `GET /ready`, `GET /docs`, `GET /docs/json` |

Example: `GET /listings` and `GET /api/v1/listings` are the same v1 handler.

The storefront may keep calling unversioned paths. New integrations should call `/api/v1`.

## What is versioned

Domain module routes mounted from `server/src/app.ts`:

`/auth`, `/users`, `/sellers`, `/products`, `/listings`, `/orders`, `/payments`, `/commissions`, `/reviews`, `/admin`

That includes authenticated and admin routes. “Public” here means the HTTP API exposed to clients, not “unauthenticated only”.

## What is not versioned

- Liveness and readiness (`/health`, `/ready`) — Render probes `/ready`; Docker HEALTHCHECK uses `/health`.
- OpenAPI UI and JSON (`/docs`, `/docs/json`).
- Unknown prefixes such as `/api` or `/api/v2` — generic 404 until a later Specification adds them.

`GET /api/v1/health` is not part of the contract.

## Backward-compatible changes (allowed on v1)

These may ship under `/api/v1` and the unversioned aliases without a new major version:

- New optional request JSON fields or query parameters (absent = previous behavior).
- New response fields. Clients must ignore unknown properties.
- New endpoints under `/api/v1`.
- Relaxed validation that still accepts every previously valid request.
- Additive OpenAPI documentation.

## Breaking changes (not allowed in place on v1)

A change is breaking when an existing conforming client would fail or misinterpret the result. Examples:

- Remove or rename a URL, field, header, or enum value.
- Change a field type or its meaning (including money encoding).
- Change a success or error HTTP status for an existing request.
- Add a required request field or header.
- Tighten authentication or authorization so a previously valid call fails.
- Change the default pagination response shape (`OffsetPage` vs `CursorPage` defaults).

Breaking changes require a new major prefix (`/api/v2`, …) and an Accepted Specification. Do not silently change v1.

## Deprecation

1. Mark the field, path, or alias deprecated in OpenAPI and in this document.
2. Keep the old behavior working on v1 / unversioned aliases.
3. Remove it only in a later major version after a documented migration window.

This increment deprecates **nothing**. Unversioned aliases are supported, not sunset.

## Client migrations

1. Point the API base at `{origin}/api/v1` (or prefix each path).
2. Keep the same resource paths (`/auth/login`, `/listings`, `/orders`, …).
3. Keep the same headers (`Authorization`, `Idempotency-Key`, `X-Request-Id`).
4. Treat additional response fields as ignorable.

No frontend change is required for this issue. Unversioned calls continue to work.

### PayPal webhook

`POST /payments/webhook` remains the documented production registration URL. `POST /api/v1/payments/webhook` accepts the same signed payload and headers. Changing the URL in the PayPal Dashboard is an operations choice, not part of this deploy. Do not invent webhook environment variables.

## OpenAPI

- Swagger UI: `GET /docs`
- Raw spec: `GET /docs/json`
- Business operations use servers whose URL includes `/api/v1`.
- Health and ready operations stay host-rooted.

## Security

Versioning does not weaken CORS, security headers, JSON body limits, JWT auth, ownership checks, or rate limits. Switching between `/auth/login` and `/api/v1/auth/login` does not bypass `authLimiter`.
