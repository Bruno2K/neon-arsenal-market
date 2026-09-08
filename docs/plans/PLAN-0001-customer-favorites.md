---
id: PLAN-0001
status: Draft
version: 1
source_spec: SPEC-0004
source_spec_version: 1
baseline_revision: 232c2922eca1eadc7deccf4d6509da0430566010
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [PLAN-0001] — Persisted customer favorites

## Status

`Draft`. `SPEC-0004` v1 remains `Proposed`, and its listing-eligibility, deletion, and final response-contract decisions are unresolved. This Plan is a reproducible decomposition example for F3.1; it does not authorize implementation.

## Source

- Specification: `SPEC-0004` v1 (`Proposed`)
- Issue: `#106`
- Planning task: F3.1 — Definir contrato de Plan
- Baseline: `232c2922eca1eadc7deccf4d6509da0430566010`

## Current State

Repository search at the baseline finds no Favorite model, module, route, API client, account page, or favorite tests. `server/prisma/schema.prisma` has User and Listing but no persisted relation for this behavior. The backend follows controller → service → repository modules under `server/src/modules/`; listings and users provide adjacent conventions.

The frontend renders listings through `src/components/ProductCard.tsx`, detail in `src/pages/ListingDetail.tsx`, protected account routes in `src/App.tsx`, and account navigation in `src/pages/Account.tsx` and `src/components/Header.tsx`. Existing tests cover ListingCard, ListingDetail, Account, and routing. React Query and the authenticated API client are already dependencies. `src/lib/redirect.ts` is the existing safe redirect boundary.

## Goal

Once the source Specification is accepted, deliver account-owned persisted favorites across the API, listing surfaces, and account page while preserving listing lifecycle and ownership invariants.

## Affected Areas

Candidate backend files:

- `server/prisma/schema.prisma` and a new immutable migration.
- A new `server/src/modules/favorites/` controller, DTO, service, repository, routes, and focused tests.
- Server route registration and `server/src/shared/docs/openapi.ts`.
- PostgreSQL integration tests for uniqueness, ownership, retries, and listing status independence.

Candidate frontend files:

- A new favorites API module and query/mutation hook or the nearest established equivalent.
- `src/components/ProductCard.tsx` and `src/pages/ListingDetail.tsx` for toggle entry points.
- A new account favorites page plus routes/navigation in `src/App.tsx`, `src/pages/Account.tsx`, and possibly `src/components/Header.tsx`.
- Existing adjacent test suites and new page/API tests.

Exact new filenames remain candidates until the accepted contract and F3.2 Task scopes exist.

## Architecture

Add a favorites domain module within the modular monolith. HTTP handlers validate and authenticate, the service owns business rules, the repository owns Prisma access, and PostgreSQL is the source of truth. Frontend state uses the existing API and React Query boundaries. No cache, queue, outbox, worker, microservice, or external provider is justified by `SPEC-0004`.

`INV-AUTH-OWNERSHIP` governs all reads and mutations. Favorite writes never call reservation/payment services and never mutate Listing status, preserving `INV-LISTING-EXCLUSIVE-RESERVE` and `INV-LISTING-SOLD-IRREVERSIBLE`.

## Database

The intended relation is one Favorite row per authenticated customer and listing, protected by a database unique constraint on `(userId, listingId)` and foreign keys. The migration must be new and must not edit applied migrations.

The accepted Specification must decide physical listing deletion behavior before the foreign-key action is selected. The Plan therefore does not choose cascade, restrict, or soft-delete semantics. Duplicate POST must use an atomic insert/no-op or catch only the exact uniqueness conflict; a read-before-insert alone is insufficient under concurrency. GET and DELETE filter by caller identity. No multi-aggregate transaction is expected, but integration tests must prove concurrent add and listing-state independence.

## Implementation Sequence

1. Resolve the open product/API decisions in `SPEC-0004`, accept its exact version, and re-evaluate this Draft against that version.
2. After F3.2 defines Task artifacts, split backend persistence/API, backend integration evidence, frontend client/toggle, account experience, and end-to-end verification into bounded nodes.
3. Implement schema and repository/service invariants, then API registration and OpenAPI contracts.
4. Prove database uniqueness, ownership, idempotent retry, delete semantics, missing-listing behavior, and no Listing status mutation with PostgreSQL integration tests.
5. Implement the client contract and server-backed state, then listing-card/detail toggles and the protected account page.
6. Add optimistic rollback, guest safe-return, loading/empty/error/sold states, and focused frontend tests.
7. Run narrow checks first, then integration, typecheck, lint/build and independent convergence against every accepted criterion.

## Task Graph

These are Plan decomposition labels, not canonical Task artifacts:

```text
FAV-A Spec decisions/acceptance → FAV-B Schema/API → FAV-C Backend integration evidence
                              FAV-B → FAV-D Client state → FAV-E Listing toggles
                                                  FAV-D → FAV-F Account page
                              FAV-C + FAV-E + FAV-F → FAV-G Convergence/verification
```

FAV-E and FAV-F may run in parallel only after FAV-D stabilizes the client interface and their write scopes are made disjoint. Backend schema/API and its integration tests remain sequential because they share persistence contracts. F3.2 will decide canonical Task IDs, ownership metadata, and dependency representation.

## Testing Strategy

- `SPEC-0004` AC-01/02/04: PostgreSQL integration tests for persistence across clients, unique concurrent add, repeated POST, removal, and repeated DELETE under the accepted contract.
- AC-03: authenticated route/service integration tests for CUSTOMER ownership, guest 401, non-CUSTOMER 403, and cross-user isolation.
- AC-05: browser/component route test for guest login and safe return without account persistence in local storage.
- AC-06: component tests for pending state, one in-flight mutation, rollback and error feedback.
- AC-07: integration assertion that add/remove leaves Listing status unchanged; UI test retains SOLD badge and related navigation.
- AC-08: account-page tests for loading, empty, error and success plus API test for missing listing.

Tests that depend on uniqueness and concurrent writes use real PostgreSQL. Mocked repository tests may cover service branching but cannot replace database evidence.

## Verification Strategy

Commands remain provisional until F3.2 binds them to concrete Tasks:

- `npm --prefix server run typecheck`
- focused backend unit tests under the future favorites module
- `npm --prefix server run test:integration -- <favorites integration files>` against a dedicated migrated PostgreSQL database
- `npm run typecheck`, focused frontend Vitest files, `npm run lint`, and `npm run build`
- `python scripts/ai-factory/validate.py`

The verifier maps each accepted AC to executed output, inspects the migration and ownership predicates, and checks that no client-only persistence is presented as account state. Placeholder test paths must be replaced with exact commands before this Plan can become `Ready`.

## Risks

- Cross-user disclosure or deletion. Mitigation: derive user from auth and include it in every repository predicate; verify with two-user integration cases.
- Duplicate concurrent rows. Mitigation: database uniqueness plus atomic conflict handling; verify simultaneous POST.
- Listing lifecycle coupling. Mitigation: Favorite operations write only the relation; assert Listing status before/after.
- Optimistic UI diverges after network ambiguity. Mitigation: serialize per-listing mutations, roll back known failures, and refetch after uncertain outcomes.
- Unsafe guest return URL. Mitigation: use the existing local redirect helper and route tests.
- Physical deletion semantics could cause data loss or stale references. Mitigation: keep this Plan Draft until the Spec selects behavior and migration rollback implications are reviewed.
- Scope could expand into alerts or event processing. Mitigation: preserve explicit non-goals and stop on outbox/worker proposals.

Residual risk: the exact public response representation and listing eligibility can change the DTO, migration policy, and UI states. Those are Specification decisions, not implementation choices.

## Dependencies

- Human acceptance of `SPEC-0004` and its response/error, repeated DELETE, non-ACTIVE eligibility, and physical deletion decisions.
- A new Plan revision or replacement bound to the accepted Specification version.
- F3.2 Task contract before executable task artifacts are emitted.
- Dedicated PostgreSQL test database with migrations applied for concurrency evidence.
- Existing authentication, Listing representation, React Query, account routing, and safe redirect helper remain available at implementation baseline.

## Stop Conditions

Stop if the accepted Specification changes from v1, a Favorite operation needs to mutate reservation/payment/listing status, ownership cannot be enforced in repository predicates, deletion behavior remains unresolved when writing the migration, exact API behavior conflicts with existing public contracts, or the work requires alerts, workers, queues, or another service. Return to HUMAN for the product decisions explicitly listed in `SPEC-0004`.

## Definition of Done

- Source Specification is Accepted and this Plan has been re-evaluated against its exact version and implementation baseline.
- F3.2-derived Tasks cover all accepted criteria with explicit dependencies and one owner each.
- Schema, API, UI, OpenAPI and documentation implement only the accepted scope.
- PostgreSQL and frontend evidence proves every accepted criterion, including races, ownership and rollback.
- Typecheck, relevant tests, lint/build, artifact validation, risk review and independent convergence pass.
- PR and evidence preserve Issue → Spec → Plan → Task traceability without relying on chat context.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `#106`
- Specification: `SPEC-0004` v1 (`Proposed`)
- Plan: `PLAN-0001` v1 (`Draft`)
- Tasks: Plan labels only; canonical artifacts pending F3.2 and Spec acceptance
- PR: `#176` is the F3.1 contract PR; no favorites implementation PR
- Verification/Convergence: F3.1 structural evidence only; feature evidence pending
- Evaluation: pending F5
- Memory: pending F6

## Change History

- `v1` — Initial Draft example from baseline `232c2922eca1eadc7deccf4d6509da0430566010`; blocked on `SPEC-0004` acceptance — 2026-09-06
