---
id: TASK-0011
status: Done
version: 1
source_spec: SPEC-0011
source_spec_version: 1
source_plan: PLAN-0010
source_plan_version: 1
baseline_revision: 8765f5dd147f813c831e8adf3caca569e3b18c3d
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [TASK-0011] — Enforce BRL from listing input through settlement

## Status

`Done`.

## Source

- Specification: `SPEC-0011` v1
- Plan: `PLAN-0010` v1
- Plan node: single vertical correction

## Objective

Remove the USD-label/BRL-charge mismatch by enforcing BRL for sellable listings and isolating provider USD values as catalog reference data.

## Scope

API, database, migration, cs2.sh import, seeds, frontend monetary surfaces, OpenAPI, architecture documentation, invariants, tests, and verification evidence required by `SPEC-0011`. No FX, refund, payment-state, commission, or reconciliation behavior.

## Allowed Files

- `docs/specs/SPEC-0011-single-checkout-currency.md`
- `docs/plans/PLAN-0010-single-checkout-currency.md`
- `docs/tasks/TASK-0011-single-checkout-currency.md`
- `docs/adr/**`
- `docs/architecture/**`
- `docs/domain/**`
- `docs/operations/runbook.md`
- `docs/verification/single-checkout-currency.md`
- `render.yaml`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260908160000_single_checkout_currency_brl/**`
- `server/src/modules/listings/**`
- `server/src/modules/products/**`
- `server/src/scripts/seedDemoData.ts`
- `server/src/shared/config/**`
- `server/src/shared/docs/**`
- `server/src/shared/domain/**`
- `server/src/shared/integrations/cs2sh/**`
- `server/src/__tests__/**`
- `src/**`

## Preconditions

`SPEC-0011` is Accepted, `PLAN-0010` is Ready, and roadmap PR 01 is present in the baseline.

## Acceptance Criteria

- [x] `AC-01` Listing creation defaults to BRL and rejects every explicit non-BRL value. **Evidence:** test
- [x] `AC-02` PostgreSQL defaults and constrains Listing currency to BRL after relabeling existing rows without changing prices. **Evidence:** integration
- [x] `AC-03` PayPal, order snapshots, and seller-ledger amounts retain the existing BRL Decimal contract. **Evidence:** test
- [x] `AC-04` cs2.sh import stores USD only as Product reference data and creates no sellable listing. **Evidence:** integration
- [x] `AC-05` Buyer, seller, and administrator checkout-price surfaces identify amounts as BRL and offer no USD input. **Evidence:** test
- [x] `AC-06` OpenAPI, invariants, ADRs, schema, runbook, and deployment configuration describe one contract. **Evidence:** static check

## Dependencies

None

## Risks

Accidental numeric conversion, provider-price leakage into inventory, stale Prisma generation, or a UI surface retaining ambiguous currency formatting.

## Verification Command

Run with the documented build environment and a disposable PostgreSQL 16 `DATABASE_URL` / `TEST_DATABASE_URL`:

```bash
npm run lint
npm run typecheck
npm test -- --run --reporter=dot
npm run build
npm run db:generate --prefix server
npm run db:migrate:deploy --prefix server
npm run typecheck --prefix server
npm run test:unit --prefix server -- --reporter=dot
npm run test:contract --prefix server -- --reporter=dot
npm run test:integration --prefix server -- --reporter=dot
npm run build --prefix server
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
git diff --check
```

## Expected Evidence

Focused currency tests and full regression suites pass; migration 20260908160000 applies; PostgreSQL rejects non-BRL writes; cs2.sh creates no listing; documentation contracts pass; remote CI is green.

## Stop Conditions

- Stop if the work requires FX conversion, provider-side capture changes, refund semantics, or a destructive migration.
- Stop before editing outside `Allowed Files`.
- Stop if an authoritative artifact contradicts the BRL-only decision.

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

- Specification: `SPEC-0011` v1
- Plan: `PLAN-0010` v1
- Task: `TASK-0011` v1
- PR: pending
- Evidence: `docs/verification/single-checkout-currency.md` plus CI

## Change History

- 2026-09-08 — v1 — BRL checkout contract implemented and verified locally.
