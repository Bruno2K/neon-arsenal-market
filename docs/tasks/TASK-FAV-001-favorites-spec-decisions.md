---
id: TASK-FAV-001
status: Blocked
version: 1
source_issue: "#106"
source_spec: SPEC-0004
source_spec_version: 1
source_plan: PLAN-0001
source_plan_version: 1
baseline_revision: 624f14a0ed3bbd8a2671e1fcace0f70866ab9106
owner: HUMAN
created: 2026-09-07
updated: 2026-09-07
---

# [TASK-FAV-001] — Resolve customer favorites contract decisions

## Status

`Blocked` — SPEC-0004 remains `Proposed`; its open product and API decisions require human acceptance before the factory can treat the feature chain as authorized and converged.

## Source

- GitHub Issue: #106
- Specification: SPEC-0004 v1
- Plan: PLAN-0001 v1
- Plan node: FAV-A

## Objective

Resolve the open response, error, deletion, and listing-eligibility decisions in SPEC-0004 so its owner can accept a stable favorites contract.

## Scope

Decide and document the four open questions already listed in SPEC-0004. Product implementation, schema changes, and API code are excluded.

## Allowed Files

- `docs/specs/SPEC-0004-customer-favorites.md`

## Preconditions

- A human product owner is available to make the listed decisions.
- PLAN-0001 remains at version 1 while this Task is evaluated.

## Acceptance Criteria

- [ ] `AC-01` SPEC-0004 defines canonical success and error response bodies. **Evidence:** manual review
- [ ] `AC-02` SPEC-0004 defines repeated `DELETE` semantics. **Evidence:** manual review
- [ ] `AC-03` SPEC-0004 defines favorite eligibility for non-`ACTIVE` listings. **Evidence:** manual review
- [ ] `AC-04` SPEC-0004 defines behavior when a listing is physically deleted. **Evidence:** manual review
- [ ] `AC-05` The Specification owner marks SPEC-0004 `Accepted` with an incremented version and change history. **Evidence:** static check

## Dependencies

None.

## Risks

- Ambiguous deletion or eligibility semantics could produce incompatible backend and client behavior.
- Accepting the Specification without all four decisions would falsely unblock downstream Tasks.

## Verification Command

```bash
python scripts/ai-factory/validate.py
```

## Expected Evidence

- Accepted SPEC-0004 with all four decisions and updated change history.
- Passing AI Factory artifact validation.
- No application or database files changed.

## Stop Conditions

- Stop if resolving a decision conflicts with an accepted invariant or ADR.
- Stop if PLAN-0001 changes version before the Specification decision is recorded.
- Stop before editing any file outside `Allowed Files`.

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-07 — v1 — Created as a blocked human decision Task from PLAN-0001 node FAV-A.
