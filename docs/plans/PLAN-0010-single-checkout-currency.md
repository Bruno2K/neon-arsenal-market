---
id: PLAN-0010
status: Ready
version: 1
source_spec: SPEC-0011
source_spec_version: 1
baseline_revision: 8765f5dd147f813c831e8adf3caca569e3b18c3d
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [PLAN-0010] — Enforce one BRL checkout currency

## Status

`Ready`

## Source

- Specification: `SPEC-0011` v1
- Consolidated roadmap: PR 02 — Fixar o contrato monetário em BRL
- Baseline: `8765f5dd147f813c831e8adf3caca569e3b18c3d`

## Current State

Listings accept arbitrary currency labels and default to USD, while order snapshots, PayPal capture, and the seller ledger interpret the same numeric amount as BRL. The cs2.sh importer also crosses the catalog/checkout boundary by copying a USD reference ask into sellable inventory. Existing Decimal arithmetic and payment idempotency are correct but operate on an ambiguous denomination.

## Goal

Make BRL the only transactional denomination from listing creation through checkout and settlement, while retaining cs2.sh USD values only as non-transactional product reference data.

## Affected Areas

- Listing API validation, persistence schema, migration, service, and tests.
- cs2.sh configuration, mapping, import behavior, seed data, and tests.
- Frontend listing forms, monetary presentation, API types, and tests.
- OpenAPI, money policy, invariants, ADRs, runbook, and Render configuration.

Refund behavior, FX conversion, PayPal state transitions, and ledger arithmetic are excluded.

## Architecture

The existing modular-monolith boundaries remain unchanged. `Listing.price` becomes explicitly BRL at the API and PostgreSQL boundaries. `Product.referencePriceUsd` remains catalog metadata and cannot create inventory. ADR 0022 records the durable decision; no currency abstraction or FX service is introduced.

## Database

One forward PostgreSQL migration relabels existing listing currency values to BRL without changing Decimal prices, changes the default, and adds `Listing_currency_brl_chk`. The migration is transactional and does not touch orders, reservations, payments, or ledger rows. Rollback requires a new forward migration because historical labels did not govern the effective checkout denomination.

## Implementation Sequence

1. Establish the accepted Spec, ADR, invariant, Plan, and Task against the updated main baseline.
2. Enforce BRL in Zod, Prisma/PostgreSQL, application services, seed data, and OpenAPI.
3. Isolate cs2.sh USD data in `Product.referencePriceUsd` and stop creating sellable listings from provider asks.
4. Converge frontend inputs, labels, types, and formatting on BRL.
5. Execute focused and full frontend/backend suites, migration validation, integration tests, documentation contracts, and diff review.
6. Publish one PR and use remote CI as the final evidence gate.

## Task Graph

Single Task — no dependency graph. `TASK-0011` owns the vertical correction.

## Testing Strategy

- Unit tests prove the API rejects non-BRL input and formatting exposes BRL.
- PostgreSQL integration tests prove the default and CHECK constraint.
- cs2.sh integration tests prove USD remains reference-only and no sellable listing is created.
- Existing order, payment, ledger, OpenAPI, and frontend suites protect downstream behavior.
- Migration deployment against disposable PostgreSQL proves forward compatibility.

## Verification Strategy

Run frontend lint, typecheck, unit tests, and build; backend typecheck, unit, contract, integration tests, and build; Prisma generation and migration deployment against disposable PostgreSQL; documentation validator and validator tests; then confirm remote CI.

## Risks

- Relabeling historical rows could be mistaken for FX conversion. Mitigation: preserve numeric amounts and document that BRL already governed capture and settlement.
- Provider USD values could leak back into listings. Mitigation: remove listing creation from the importer and cover the boundary with unit and integration tests.
- Stale generated Prisma artifacts could retain USD defaults. Mitigation: generate the client before integration tests and keep that order in CI.
- Broad UI formatting changes could create regressions. Mitigation: use one shared BRL contract and run the complete frontend suite.

## Dependencies

- PR 01 of the consolidated roadmap merged as `8765f5dd147f813c831e8adf3caca569e3b18c3d`.
- Disposable PostgreSQL 16 for migration and integration evidence.

## Stop Conditions

- Stop if multi-currency or FX support is requested; that requires a new Specification.
- Stop if numeric price conversion is proposed without a product decision and rate-snapshot contract.
- Stop if the migration cannot preserve existing order, payment, reservation, and ledger state.
- Stop before changing refund, capture, commission, or reconciliation semantics.

## Definition of Done

All `SPEC-0011` acceptance criteria map to executed evidence; schema and API reject non-BRL listings; provider USD remains catalog-only; migration and PostgreSQL suites pass; documentation and OpenAPI converge; remote CI is green; the PR records remaining risk.

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

- Specification: `SPEC-0011` v1
- Plan: `PLAN-0010` v1
- Task: `TASK-0011` v1
- PR: pending
- Evidence: `docs/verification/single-checkout-currency.md` plus CI

## Change History

- `v1` — Ready plan for the single BRL checkout contract — 2026-09-08
