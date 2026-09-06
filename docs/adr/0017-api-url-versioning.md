# ADR 0017 — URI path versioning for the public API

## Status

Accepted

## Context

Issue #60 / `SPEC-0007` requires a public `/api/v1` prefix and a written compatibility policy.

Today `server/src/app.ts` mounts domain routers at unversioned paths. The storefront calls those paths. PayPal is documented against `POST /payments/webhook`. Render probes `GET /ready`. There is no version in the URL and no rule for what may change in place.

Alternatives considered:

1. **Header or media-type versioning** — invisible in logs and browser URLs; easy to omit; not what the issue asked for.
2. **Hard-cut to `/api/v1` only** — breaks the current storefront and the registered PayPal webhook URL in the same deploy.
3. **URI prefix `/api/v1` plus unversioned aliases of the same routers** — matches the issue, keeps existing clients working, and gives a place for a future `/api/v2`.

## Decision

1. **Version in the URL.** The current public contract is `/api/v1`.
2. **Mount the same domain routers twice** (unversioned and `/api/v1`) from the composition root `app.ts`. Do not copy handlers or invent a second payments stack.
3. **Leave `/health`, `/ready`, `/docs`, and `/docs/json` unversioned.** They are operational. Render `healthCheckPath` stays `/ready`.
4. **Unversioned domain paths are v1 aliases**, not a second contract. They share `authLimiter`, validation, and services.
5. **Breaking changes require a new major prefix** and a later Accepted Specification. Additive changes may land on v1.
6. **Do not change PayPal Dashboard configuration in this change.** Both `/payments/webhook` and `/api/v1/payments/webhook` accept the same signed events.
7. **No new environment variables.**

Policy text lives in `docs/architecture/api-versioning.md`.

## Rollback

Remove the `/api/v1` mount and the documentation/OpenAPI server entries. Unversioned paths remain the previous contract.

## Consequences

- Clients can migrate to `/api/v1` without a flag day.
- Rate limits and auth apply to both prefixes (shared limiter instances).
- OpenAPI Try-it-out uses the `/api/v1` server for business paths; health/ready override servers to the host root.
- A future `/api/v2` is a new Specification, not an in-place rewrite of v1.
