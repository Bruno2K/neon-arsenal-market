---
id: SPEC-0004
status: Proposed
version: 1
source_issue: "#106"
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0004] — Persisted customer favorites

## Status

`Proposed`. Issue #106 defines intended behavior; main 0d43679 has no Favorite model or favorites API. This is a reviewable proposal, not a claim of implementation or permission to begin the feature.

## Problem

Customers cannot save unique listings to their account and recover that list across reloads and devices.

## Goal

An authenticated CUSTOMER saves/removes a listing and sees the persisted result in their account; guests are guided through login.

## Actors

CUSTOMER, guest, storefront client, authenticated API, PostgreSQL.

## Scope

Account-owned Favorite relation; list/add/remove API; listing card and detail heart controls; /account/favorites; optimistic feedback and rollback; guest return path.

## Non-goals

Price alerts, outbox events, workers, sharing lists, reservations, payment changes or localStorage as account persistence. Automatic pending favorite after login is optional in #106 and is not required here.

## Business Rules

- `BR-01`: Derive owner from authenticated CUSTOMER identity, never from userId in client input. Favorites of another user are inaccessible.
- `BR-02`: At most one Favorite exists per (userId, listingId); repeated POST is 200/no-op.
- `BR-03`: Saving does not reserve or buy a listing, change availability or grant ownership.
- `BR-04`: A saved SOLD listing remains visible with a Vendido badge and a link to related listings.
- `BR-05`: Guest favorite intent opens login and returns to the relevant listing; persistence requires authentication.
- `BR-06`: Optimistic toggles roll back on error; reload reads server state. Missing listings cannot be added.

## Invariants

- `INV-AUTH-OWNERSHIP` — private customer data remains owner-scoped.
- `INV-LISTING-EXCLUSIVE-RESERVE` — favorites do not participate in reservation.
- `INV-LISTING-SOLD-IRREVERSIBLE` — saving/removing never changes SOLD.

These IDs come from docs/domain/invariants.md. Favorite uniqueness is the proposed BR-02, not an invented canonical invariant ID; catalog/schema/test updates belong to feature implementation.

## State Transitions

Not saved → saved through POST. Saved → not saved through DELETE. Repeated POST remains saved. Proposed repeated DELETE remains absent. Listing status evolves independently; SOLD does not remove a saved relation. Pending UI → confirmed on success or previous state on error.

## API / Data Contract

Issue-defined routes: authenticated GET /favorites, POST /favorites with `{ "listingId": "..." }`, DELETE /favorites/:listingId. Persistence requires Favorite(userId, listingId) with database uniqueness. UI route: /account/favorites.

For review, proposed details complete the issue's unspecified HTTP surface: GET 200 `{ "items": [...] }` with each item carrying listingId and the existing public listing representation; POST 200 `{ "listingId": "..." }` for both create and duplicate; DELETE 204 for present or absent own favorite. Invalid listingId input returns 400, missing listing on POST returns 404, unauthenticated access returns 401, non-CUSTOMER access returns 403. Owner identity is never selectable. Response DTOs/OpenAPI must be finalized with the implementation plan; these proposed choices are not existing APIs.

## Concurrency Model

Use PostgreSQL uniqueness plus an atomic insert/no-op for duplicate POST, not an unchecked read-then-insert. Removal filters by authenticated user and listing ID. Concurrent identical adds leave one row; repeated removes leave none. Opposing add/remove operations have database execution order, not client click-time ordering. UI should serialize toggles per listing and reconcile with GET after uncertain outcomes. No external side effect or queue is required.

## Failure Modes

Lost POST response can be retried without duplicates. Lost DELETE response can be retried under the proposed absent/no-op contract. Database failure must not be shown as persisted success. UI restores prior state on error and refetches when outcome is uncertain. Sold status is not a missing listing. Hard deletion policy and eligibility for newly saving CANCELED/RESERVED listings are not defined by #106 and must be settled before this Spec is Accepted.

## Security

Preserve JWT authentication, CUSTOMER authorization, input validation and rate limiting. GET/DELETE are always scoped to the caller. Login return URLs must use the existing safe local redirect handling. Do not log tokens or full private favorite lists.

## Observability

Use existing request IDs and structured error handling for API failures. No dedicated favorites telemetry exists today; avoid claiming it. Tests must distinguish persistence errors from optimistic UI success.

## Backward Compatibility

Additive proposal only. Future implementation needs Prisma schema plus a new migration, ownership tests and OpenAPI updates. It must preserve listing/payment invariants and current account routes. This F2.3 change contains no migration or runtime feature.

## Acceptance Criteria

- [ ] `AC-01` — CUSTOMER saves a listing and sees it after reload and in a second authenticated client. **Evidence:** integration
- [ ] `AC-02` — Repeated and concurrent POSTs return success with exactly one database relation. **Evidence:** integration
- [ ] `AC-03` — GET/DELETE cannot disclose or mutate another customer's favorites; guests and non-CUSTOMER roles are rejected. **Evidence:** integration
- [ ] `AC-04` — Removing a favorite survives reload; repeated DELETE succeeds under the proposed no-op contract. **Evidence:** integration
- [ ] `AC-05` — Guest heart action reaches login and safely returns to the listing without presenting local storage as account persistence. **Evidence:** test
- [ ] `AC-06` — Card/detail toggle shows pending state and rolls back with error feedback when the API fails. **Evidence:** test
- [ ] `AC-07` — Saved SOLD items retain their badge and related link; saving/removing never changes listing status or reserves inventory. **Evidence:** integration
- [ ] `AC-08` — Account list supports loading, empty, error and success states; missing listing addition fails without a relation. **Evidence:** test

## Verification Strategy

No favorites tests exist on the inspected main; all feature criteria above are pending. Before implementation, accept this proposal and resolve the open decisions below. Add real PostgreSQL uniqueness/concurrent-add/ownership tests for AC-01–04/07; API missing-listing checks for AC-08; client tests for AC-05/06/08. Test response-loss retries and optimistic error recovery. Run the established server integration suite against a dedicated migrated database and frontend Vitest suite once those tests exist. F2.3 itself runs the artifact validator and Issue-to-Spec discovery only.

## Decisions / References

- https://github.com/Bruno2K/neon-arsenal-market/issues/106
- docs/domain/invariants.md
- server/prisma/schema.prisma (current baseline, not a Favorite implementation)
- src/pages/Account.tsx
- src/lib/redirect.ts

Before acceptance: approve proposed response/error shapes and repeated DELETE semantics; decide initial save eligibility for non-ACTIVE listings and behavior if a listing is physically deleted. No decision is needed to review this documentation increment; runtime implementation remains gated.

## Traceability

GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY

- Issue: #106
- Spec: SPEC-0004 v1
- Plan/Tasks: Notion F2.3 conversion; feature implementation stays in #106; formal Plan deferred to F3
- PR: F2.3 documentation PR, pending publication
- Verification/Convergence: docs/verification/f2-3-real-flow-specs.md
- Evaluation/Memory: lightweight evidence in that record; feature acceptance and F5/F6 remain pending

## Change History

- v1 — Proposed contract transcribed from #106 with additional choices explicitly marked for review — 2026-09-06.
