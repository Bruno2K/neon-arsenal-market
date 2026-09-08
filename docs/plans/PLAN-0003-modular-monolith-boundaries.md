---
id: PLAN-0003
status: Ready
version: 1
source_spec: SPEC-0006
source_spec_version: 1
baseline_revision: 191d5c80a884e950bb4516f9afc2cc926c33c268
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [PLAN-0003] — Explicit modular monolith boundaries

## Status

`Ready`

## Source

- Specification: `SPEC-0006` v1
- Issue: `#59`
- Planning task: issue #59 Backend + Reliability + Security + Test + Verification
- Baseline: `191d5c80a884e950bb4516f9afc2cc926c33c268`

The Plan derives implementation work from the Specification. It may narrow implementation choices but must not add, remove, or reinterpret acceptance criteria.

## Current State

Inspected at the baseline:

- Domain folders exist under `server/src/modules/`: auth, users, sellers, products, listings, orders, payments, commissions, reviews, admin, audit.
- Issue #59 names Catalog and Ledger; folders are `products` and `commissions`.
- Production cross-module imports are Admin composing sellers/orders/products/audit, and mutating modules writing Audit.
- `app.ts` mounts routes. In-process jobs import listings, payments, and commissions services.
- `payments.service.ts` owns PaymentLink, webhook claim, capture, reconcile, and `confirmPayment`. PayPal HTTP is in `shared/utils`.
- No machine-readable import graph. No eslint/dependency-cruiser.
- `SPEC-0005` is already the API security-hardening Specification (#58). This Plan uses `SPEC-0006`.

## Goal

Document the module map and allowed edges, encode them in TypeScript, and fail unit tests on forbidden production imports. Do not rename folders, split Payments, or change runtime behavior.

## Affected Areas

- `docs/specs/SPEC-0006-modular-monolith-boundaries.md`
- `docs/plans/PLAN-0003-modular-monolith-boundaries.md`
- `docs/tasks/TASK-0006-enforce-module-boundaries.md`
- `docs/adr/0016-modular-monolith-boundaries.md`
- `docs/architecture/modular-monolith.md`
- `docs/architecture/current-state.md`
- `docs/architecture/c4.md`
- `AGENTS.md` (module list pointer only)
- `server/src/shared/architecture/moduleBoundaries.ts`
- `server/src/shared/architecture/__tests__/moduleBoundaries.test.ts`

No Prisma schema, route, or `src/` client changes.

## Architecture

Keep the modular monolith. Composition roots (`app.ts`, documented jobs) wire modules. Domain modules do not call each other's services except Admin → {Sellers, Orders, Catalog, Audit} and mutating modules → Audit. Cross-table writes stay inside existing transactions. ADR 0016 records the Payments non-split.

## Database

None. No schema, migration, lock, or constraint change. Existing reservation, payment-confirm, and ledger transactions are unchanged.

## Implementation Sequence

1. Accept `SPEC-0006` and mark this Plan Ready against baseline `191d5c80a884e950bb4516f9afc2cc926c33c268`.
2. Write ADR 0016 and the architecture map.
3. Encode the graph in `moduleBoundaries.ts` with a production-source scanner.
4. Add unit tests for the live tree and a synthetic forbidden edge.
5. Point `current-state.md`, `c4.md`, and `AGENTS.md` at the map.
6. Run factory validation, unit, and integration suites.

## Task Graph

```text
TASK-0006
```

Single sequential task: docs and the scanner share the same graph.

## Testing Strategy

| Criterion | Test |
|---|---|
| AC-01 | Unit: logical names map, Catalog=`products`, Ledger=`commissions` |
| AC-02 | Unit: `ALLOWED_MODULE_EDGES` matches Admin + Audit edges |
| AC-03 | Unit: `isModuleEdgeAllowed("payments", "orders")` is false |
| AC-04 | Unit: `findImportViolations(srcRoot)` is empty |
| AC-05 | Manual review of the diff + ADR 0016 |
| AC-06 | Existing integration suite (reservation, payment, ledger) |

## Verification Strategy

Independent verifier runs:

1. `python3 scripts/ai-factory/validate.py`
2. `cd server && npm run test:unit`
3. `cd server && npm run test:integration`

PostgreSQL is required for step 3. No PayPal credentials. No browser. Inspect the diff: no `src/` edits, no Payments layering, no auth/CORS/rate-limit weakening.

## Risks

- Over-strict graph would force a Payments/Orders/Listings service rewrite and risk transactional invariants. Mitigation: encode the current legal edges only; allow named cross-table SQL. Detection: AC-04 empty-violation test.
- Speculative Payments split could hide `confirmPayment` atomicity. Mitigation: `SPEC-0006` BR-08 rejects the split. Residual: the file stays large.
- SPEC ID collision with #58 (`SPEC-0005`). Mitigation: this work is `SPEC-0006`.

## Dependencies

- `SPEC-0006` v1 Accepted
- ADR 0007 Render; ADR 0011 seller ledger; ADR 0016 written in the same change

## Stop Conditions

- Request to rename folders, add microservices, or split Payments into application/domain/infrastructure
- Evidence that current production imports already violate the intended graph in a way that requires a payment-path rewrite
- Source Specification version change

## Definition of Done

Logical modules are mapped, the graph is documented and tested, current production imports pass, Payments is not split, factory validation passes, and unit plus integration suites pass.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `#59`
- Specification: `SPEC-0006` v1
- Plan: `PLAN-0003` v1
- Tasks: `TASK-0006`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready plan for SPEC-0006 — 2026-09-06
