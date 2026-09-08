---
id: TASK-0006
status: Ready
version: 1
source_issue: "#59"
source_spec: SPEC-0006
source_spec_version: 1
source_plan: PLAN-0003
source_plan_version: 1
baseline_revision: 191d5c80a884e950bb4516f9afc2cc926c33c268
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-08
---

# [TASK-0006] — Enforce modular monolith import boundaries

## Status

`Ready`

## Source

- Specification: `SPEC-0006`
- Plan: `PLAN-0003`
- Issue: #59

## Objective

Land the module map, ADR, machine-readable allowed-import graph, and unit-test enforcement without changing runtime behavior or splitting Payments.

## Scope

Architecture docs, ADR 0016, `server/src/shared/architecture/*`, and factory artifacts for #59. Unrelated cleanup is out of scope. Do not edit `src/`.

## Allowed Files

Architecture docs, ADR 0016, `server/src/shared/architecture/*`, and factory artifacts named in Scope.

## Preconditions

- Isolated worktree from `origin/main` at PLAN-0003 `baseline_revision`
- `SPEC-0006` accepted
- Current production cross-module imports are Admin composition and Audit writes only

## Acceptance Criteria

- [ ] `AC-01`: Logical module names map to folders, including Catalog=`products` and Ledger=`commissions` **Evidence:** static check
- [ ] AC-02: Allowed edges live in `moduleBoundaries.ts` and `docs/architecture/modular-monolith.md`
- [ ] AC-03: Unit test fails a forbidden production import and passes the current tree
- [ ] AC-04: Payments service is not re-layered
- [ ] AC-05: `npm run test:unit` and `npm run test:integration` pass

## Dependencies

`PLAN-0003` Ready.

## Risks

Encoding a stricter graph than the current tree would require importing refactors inside payment/order transactions.

## Verification Command

```bash
python3 scripts/ai-factory/validate.py
cd server && npm run test:unit
cd server && npm run test:integration
```

## Expected Evidence

Validator PASS. Unit suite PASS including `moduleBoundaries.test.ts`. Integration suite PASS with no payment/reservation failures. Diff contains no `src/` and no Payments split.

## Stop Conditions

Stop if enforcing the graph requires payment/order transaction refactors or files outside Allowed Files.

## Traceability

GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY

## Change History

- 2026-09-08 — Migrated to the task artifact contract.
