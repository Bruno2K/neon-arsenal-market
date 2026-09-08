---
id: PLAN-EXAMPLE-001
status: Draft
version: 1
source_spec: SPEC-EXAMPLE-001
source_spec_version: 1
baseline_revision: 0000000000000000000000000000000000000000
owner: "team"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# [PLAN-EXAMPLE-001] — Title

## Status

`Draft` | `Ready` | `Superseded`

A Plan becomes executable only when it is `Ready`, its source Specification is `Accepted`, and `source_spec_version` still matches that Specification.

## Source

- Specification: `SPEC-EXAMPLE-001` v1
- External tracker: `#...` (optional)
- Planning task: `...`

The Plan derives implementation work from the Specification. It may narrow implementation choices but must not add, remove, or reinterpret acceptance criteria.

## Current State

Describe relevant executable behavior, tests, constraints, gaps, and evidence inspected. Distinguish observed facts from assumptions.

## Goal

State the implementation outcome this Plan will deliver without redefining the Specification.

## Affected Areas

List candidate modules, files, schema, migrations, API contracts, documentation, infrastructure, and ownership boundaries. Mark uncertain paths as candidates.

## Architecture

Explain how the change fits existing dependency direction, repository boundaries, ADRs, and invariants. State whether a new ADR is required.

## Database

Describe schema, migration, transaction, locking, constraint, rollback, and reconciliation implications. Use `None` with evidence when the Plan has no database impact.

## Implementation Sequence

1. Describe the smallest reviewable unit and its output.
2. Make dependencies and verification points explicit.
3. Stop at the Specification boundary.

## Task Graph

Use canonical `TASK-*` IDs and explicit directed edges when the Plan contains multiple dependent Tasks. For a single-task Plan, state `Single Task — no dependency graph`. The repository validator rejects missing dependencies, self-dependencies, cycles, and executable tasks whose predecessors are not `Done`.

```text
TASK-A → TASK-B → TASK-D
       ↘ TASK-C ↗
```

State which nodes may run in parallel and why their files and invariants do not overlap. Default to sequential execution.

## Testing Strategy

Map the source Specification's acceptance criteria to unit, integration, concurrency, security, contract, browser, and operational tests as applicable. Existing tests are evidence only when they prove the criterion.

## Verification Strategy

List exact commands, required environment, evidence outputs, and the independent verifier. Separate checks that can run locally from checks that require CI, PostgreSQL, credentials, or manual review.

## Risks

For each material risk, record impact, mitigation, detection evidence, and residual risk. Include consistency, failure, security, compatibility, and scope risks as applicable.

## Dependencies

List accepted decisions, upstream artifacts, external capabilities, task predecessors, and environment requirements. A missing hard dependency keeps the Plan in `Draft`.

## Stop Conditions

List conditions that require HUMAN escalation, replanning, or a new Specification version. Include source-Spec changes, conflicting authoritative artifacts, destructive operations without rollback, and material scope expansion.

## Definition of Done

Define observable conditions proving all planned work and verification are complete. Include traceability, review, documentation, and evidence requirements; do not equate compilation with completion.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → EVIDENCE
```

- External tracker: `#...` (optional)
- Specification: `SPEC-EXAMPLE-001` v1
- Plan: `PLAN-EXAMPLE-001` v1
- Tasks: `TASK-...`
- PR: pending
- Evidence: pending

## Change History

Draft revisions update this file and increment `version`. Once a Plan becomes `Ready`, its content and version are immutable except for transition to `Superseded`. Material replacement uses a new `PLAN-*` ID, preserving uniqueness and history.

- `v1` — Initial draft — YYYY-MM-DD
