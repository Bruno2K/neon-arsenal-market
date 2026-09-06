# ADR 0018 — Redis is not adopted

## Status

Accepted

## Context

Issue #71 asks for an explicit decision on Redis. Several ADRs already reject Redis as an alternative for a single concern (idempotency, webhooks, pagination, rate limits, outbox). Nothing in the repo runs Redis, Render Key Value, or an in-process Redis client.

The remaining question is whether Redis should exist as a **platform dependency** for cache, sessions, or a shared rate-limit store.

## Decision

**Do not adopt Redis.** PostgreSQL remains the source of truth for transactional state. HTTP rate limits stay in-process memory (documented in the threat model and runbook). Listing pages are not cached. Scale-out is more Render API instances plus PostgreSQL connection limits (`docs/architecture/capacity.md`, `docs/architecture/scaling-path.md`).

Rejected alternatives:

- Redis as a cache in front of `GET /listings` — `docs/performance.md` shows the page index scan is ~0.02 ms at 2.5k `ACTIVE` rows; `COUNT(*)` is the slower sibling and is still sub-millisecond. No measured trigger.
- Redis as the idempotency or webhook-event store — not durable across crash the way a unique PostgreSQL row is; ADRs 0002 and 0003 already rejected this.
- Render Key Value “because the Blueprint can provision it” — that would add a failure mode (cache/store down) the application does not have.

## Consequences

- Agents must not add `ioredis`, `redis`, or a Render `keyvalue` service unless a later ADR supersedes this one with a measured trigger from `docs/architecture/scaling-path.md`.
- Multiple API replicas do **not** share rate-limit counters. That is accepted (threat model).
- Interview answer: Redis was considered and rejected; uniqueness and payment identity live in PostgreSQL.

## What this ADR does not change

- Existing ADRs 0001–0017 (not rewritten).
- Application code, env vars, or `render.yaml`.
