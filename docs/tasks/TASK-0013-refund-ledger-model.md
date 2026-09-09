---
id: TASK-0013
status: Done
version: 1
source_spec: SPEC-0013
source_spec_version: 1
source_plan: PLAN-0012
source_plan_version: 1
baseline_revision: f6428d7243c257e5068ddd78756aee45796c8054
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [TASK-0013] — Establish durable refund and append-only ledger model

## Status

`Done`. Implemented and merged through PR #223.

## Source

- Specification: `SPEC-0013` v1
- Plan: `PLAN-0012` v1
- Plan node: local refund and ledger model

## Objective

Create the durable PostgreSQL model and migration required for idempotent full-refund obligations and append-only seller compensation without yet invoking PayPal refunds.

## Scope

Schema, migration, repositories/domain helpers, focused tests, and documentation required to represent refund lifecycle and payment/refund ledger movements. No PayPal refund HTTP call, no reconciliation scheduler, no public refund API.

## Allowed Files

- `server/prisma/schema.prisma`
- `server/prisma/migrations/**`
- `server/src/modules/payments/**`
- `server/src/modules/commissions/**`
- `server/src/shared/money/**`
- `server/src/shared/types/**`
- `server/src/__tests__/**`
- `docs/adr/0011-seller-ledger.md`
- `docs/architecture/money-policy.md`
- `docs/domain/**`
- `docs/verification/**`

## Preconditions

Implemented from PLAN-0012 / SPEC-0013 and merged as PR #223. Current main baseline: `f6428d7243c257e5068ddd78756aee45796c8054`.

## Acceptance Criteria

- [x] `AC-01` Durable refund obligation can represent captured-but-unfulfillable payment exactly once. **Evidence:** integration
- [x] `AC-04` Existing seller credit can be reversed by a distinct append-only entry with atomic balance adjustment. **Evidence:** integration
- [x] `AC-05` No seller debit is produced when no seller credit exists. **Evidence:** integration
- [x] `AC-06` Existing PAID ledger history migrates without changing effective seller balances and reconciliation remains repeatable. **Evidence:** integration

## Dependencies

None

## Risks

Destructive ledger migration, duplicate compensation identity, balance projection drift, or over-generalizing the ledger model.

## Verification Command

```bash
npm run db:generate --prefix server
npm run db:migrate:deploy --prefix server
npm run typecheck --prefix server
npm run test:integration --prefix server -- --reporter=dot
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
git diff --check
```

## Expected Evidence

Migration applies on disposable PostgreSQL; pre-existing paid-ledger fixtures preserve effective balances; duplicate refund claims/compensations no-op or conflict safely; focused integration tests pass.

## Stop Conditions

- Stop if existing financial history would need destructive rewrite.
- Stop before adding PayPal refund execution or reconciliation behavior.
- Stop before editing outside Allowed Files.

## Traceability

`SPEC → PLAN → TASK(S) → PR → EVIDENCE`

## Change History

- 2026-09-08 — v1 — Ready task released after PR 03 convergence and human-approved refund semantics.
- 2026-09-09 — TASK-0013 implemented, reviewed, CI green, and merged via PR #223.
