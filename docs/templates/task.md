---
id: TASK-DOMAIN-001
status: Blocked
version: 1
source_spec: SPEC-DOMAIN-001
source_spec_version: 1
source_plan: PLAN-DOMAIN-001
source_plan_version: 1
baseline_revision: 0000000000000000000000000000000000000000
owner: ROLE_OR_PERSON
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# [TASK-DOMAIN-001] — Imperative action with one concrete outcome

## Status

`Blocked | Ready | InProgress | Done | Superseded`

## Source

- External tracker: #123 (optional)
- Specification: SPEC-DOMAIN-001 v1
- Plan: PLAN-DOMAIN-001 v1
- Plan node: NODE-ID

## Objective

One concrete outcome.

## Scope

Describe the bounded change and its explicit exclusions.

## Allowed Files

- `path/to/file`
- `path/to/directory/**`

## Preconditions

What must already be true.

## Acceptance Criteria

- [ ] `AC-01` Source criterion or measurable outcome. **Evidence:** test
- [ ] `AC-02` Source criterion or measurable outcome. **Evidence:** static check

## Dependencies

- `TASK-DOMAIN-000`, or `None`.

## Risks

Specific risks for this task.

## Verification Command

```bash
...
```

## Expected Evidence

- Changed files and resulting behavior.
- Exact command results.
- Remaining limitations or risks.

## Stop Conditions

- Stop if a source artifact changes version or conflicts with this Task.
- Stop before editing a file outside `Allowed Files` and return to planning.

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- YYYY-MM-DD — v1 — Task created in `Blocked` or `Ready` state.
