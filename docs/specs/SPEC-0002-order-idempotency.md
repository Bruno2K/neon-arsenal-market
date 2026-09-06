---
id: SPEC-0002
status: Proposed
version: 1
source_issue: "#5"
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0002] — Order creation idempotency

## Status

`Proposed`. F2.3 retrospective contract for existing behavior, pending human review; this document does not reopen issue #5 or authorize runtime changes.

## Problem

A lost checkout response makes a buyer retry an operation that reserves unique inventory. Repeating that operation must not create another order.

## Goal

One committed order per authenticated customer and idempotency key, with deterministic replay or conflict across processes.

## Actors

Authenticated CUSTOMER, HTTP API, PostgreSQL, retrying checkout client.

## Scope

POST /orders key validation, canonical request identity, reservation transaction, durable replay and conflicting reuse.

## Non-goals

Payment capture, webhook processing, changing reservation TTL, new key retention policies, and frontend checkout changes (#82).

## Business Rules

- `BR-01`: Require a trimmed, nonempty Idempotency-Key of at most 128 characters.
- `BR-02`: Scope a key to the authenticated customer. Compare SHA-256 of the versioned, sorted listing ID set; reject duplicate listing IDs before writing.
- `BR-03`: Same key and listing set returns the original order identity, read in its current state; this is not a byte-for-byte cached HTTP response.
- `BR-04`: Different listing set with the same customer/key returns 409 without reserving new inventory.
- `BR-05`: Commit key, order, items, price snapshots and listing reservations together; payment is a separate workflow.

## Invariants

Canonical references in docs/domain/invariants.md:

- `INV-ORDER-ATOMIC-CREATE`
- `INV-LISTING-EXCLUSIVE-RESERVE`
- `INV-ORDER-TOTAL-COMPOSITION`
- `INV-AUTH-OWNERSHIP`

## State Transitions

Within one transaction: absent key → in-progress key → COMPLETED key linked to order. Failure rolls back to absent. A committed key is not reset by replay or order expiration. Listing ACTIVE → RESERVED remains conditional; replay must not reacquire an expired hold.

## API / Data Contract

POST /orders requires CUSTOMER authentication, Idempotency-Key and body `{ "items": [{ "listingId": "..." }] }`; items must be nonempty. DTO: server/src/modules/orders/orders.dto.ts. Controller returns 201 and the order for both creation and successful replay. Missing/oversized key or duplicate IDs returns 400. Missing listing returns 404; unavailable/trade-locked listing returns 400. Conflicting key, incomplete durable link or missing linked order returns 409. Existing authentication middleware governs 401/403.

OrderIdempotencyKey has unique (customerId, key), requestHash, status and orderId; server/prisma/schema.prisma is the persistence contract. Prices and totals retain Decimal semantics.

## Concurrency Model

PostgreSQL unique (customerId, key) serializes matching attempts. The loser handles only that specific unique violation and reads the committed result outside the failed transaction. Other database errors propagate. Conditional ACTIVE reservation updates protect different keys competing for the same listing. No external call runs in this creation transaction.

## Failure Modes

Before commit, a crash or reservation failure leaves no partial order/key/hold. After commit but before response, retry resolves the linked order. An unavailable database is not interpreted as success. An incomplete or missing order link returns 409 rather than silently creating a replacement. No new automatic retries or retention cleanup are specified.

## Security

Derive customerId from authentication, never request ownership fields. A shared key string across customers must not disclose another customer's order. Preserve validation, rate limits and secret redaction.

## Observability

Existing ordersService tracing distinguishes created, idempotency_replay and idempotency_conflict. Existing appMetrics records creation, failure, replay, conflict and reservations; do not add raw keys or request bodies to logs.

## Backward Compatibility

Documents ADR 0003 and current code; no API, schema or migration change. Successful replay remains 201 and may reflect later order state.

## Acceptance Criteria

- [ ] `AC-01` — Missing/blank/oversized key and repeated listing IDs fail before business writes. **Evidence:** test
- [ ] `AC-02` — Same customer/key and equivalent reordered listing set returns one original order. **Evidence:** integration
- [ ] `AC-03` — Conflicting reuse returns 409 and leaves the new listing ACTIVE. **Evidence:** integration
- [ ] `AC-04` — Two customers may use the same key without sharing results. **Evidence:** integration
- [ ] `AC-05` — Concurrent matching attempts create exactly one order and one durable key; different requests cannot reserve the same listing twice. **Evidence:** integration
- [ ] `AC-06` — Failure after key insertion rolls back the key and all related writes; a committed retry uses the original identity. **Evidence:** integration
- [ ] `AC-07` — Replay does not recreate or extend reservations, and the controller preserves 201. **Evidence:** static check

## Verification Strategy

AC-01: server/src/modules/orders/__tests__/orders.service.test.ts plus key-boundary inspection. AC-02–06: server/src/__tests__/order.idempotency.integration.test.ts (replay, ordering, conflict, customer scope, rollback and concurrent cases). AC-07: orders.service.ts replay branch and orders.controller.ts.

Run `npm --prefix server run test:unit -- src/modules/orders/__tests__/orders.service.test.ts src/modules/orders/__tests__/orders.controller.test.ts`. Against a dedicated migrated PostgreSQL test database, run `npm --prefix server run test:integration -- src/__tests__/order.idempotency.integration.test.ts`. Existing test source is a verification map, not evidence that these commands ran for F2.3. Crash boundaries additionally require transaction inspection; the replay test is not a process-kill experiment.

## Decisions / References

- docs/adr/0003-order-creation-idempotency.md
- docs/domain/invariants.md
- server/src/modules/orders/orders.service.ts
- server/prisma/schema.prisma

## Traceability

GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY

- Issue: #5 (original behavior); related client integration: #82
- Spec: SPEC-0002 v1
- Plan/Tasks: Notion F2.3; formal Plan deferred to F3
- PR: F2.3 documentation PR, pending publication
- Verification/Convergence: docs/verification/f2-3-real-flow-specs.md
- Evaluation/Memory: lightweight evidence in that verification record; no F5/F6 completion claimed

## Change History

- v1 — Proposed retrospective contract based on main 0d43679 and issue #5 — 2026-09-06.
