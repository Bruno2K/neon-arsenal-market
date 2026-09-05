# ADR 0010 — Append-only audit log for sensitive mutations

## Status

Accepted

## Context

Issue #42. Administrative actions, seller listing price/cancel, order status changes, and local payment confirmation were not recorded in a durable, queryable trail. Application logs are not an access-controlled record: they may rotate, they are not ADMIN-gated, and they must not contain credentials.

The project is a modular monolith with PostgreSQL as the source of truth. Redis, SQS, Kafka, and a dedicated audit microservice are not justified. There is already an in-process job pattern for reservation expiry and PayPal reconciliation; a scheduled purge worker is optional later and is not required to establish the trail.

## Decision

1. Persist an append-only `AuditLog` row in PostgreSQL: `actorId`, `actorRole`, `action`, `resourceType`, `resourceId`, `before`/`after` JSON, `createdAt`, optional `ip` / `userAgent`.
2. Do not foreign-key `actorId` to `User`. The trail must survive account deletion; actor identity is informational.
3. Write the audit row in the **same local database transaction** as the mutation it describes. PayPal HTTP stays outside that transaction.
4. First vertical slice instruments existing mutations only:
   - ADMIN seller approval (`SELLER_APPROVAL_CHANGED`)
   - listing price change and cancel (`LISTING_PRICE_CHANGE`, `LISTING_CANCEL`)
   - order fulfillment status transitions (`ORDER_STATUS_CHANGE`)
   - local payment confirmation (`PAYMENT_CONFIRMED`, system actor)
5. Read access is ADMIN-only (`GET /admin/audit-logs` behind `authenticate` + `requireRole("ADMIN")`). CUSTOMER/SELLER receive 403; missing auth receives 401.
6. Retention: **365 days**. `createdAt` is indexed. No Redis TTL worker and no new cron/SQS infrastructure. An operator may delete aged rows with a one-shot SQL statement when needed.
7. `before`/`after` are field-level non-sensitive diffs (status, price, approval flags). The repository redacts known secret keys and JWT-shaped values as defense in depth. Full PayPal payloads, passwords, and tokens must never be stored.

## Rollback

Drop the `AuditLog` table. Application writers become no-ops only after the call sites are removed; leaving the table is safer than losing the trail.

## Consequences

- Failed mutations roll back their audit row with them.
- Duplicate payment confirmation remains idempotent: a second claim (`updateMany` count = 0) does not write another payment audit row.
- Coverage is incomplete by design for this slice: listing `update()` status changes, order creation, tracking edits, and reservation expiry are not yet instrumented.
