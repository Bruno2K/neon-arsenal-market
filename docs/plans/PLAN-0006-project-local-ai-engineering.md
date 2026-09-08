---
id: PLAN-0006
status: Ready
version: 1
source_spec: SPEC-0009
source_spec_version: 1
baseline_revision: 168842cba79048d132153022b5af9d21f33134d8
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [PLAN-0006] — Establish the project-local AI engineering contract

## Status

`Ready`

## Source

- Specification: `SPEC-0009` v1
- External tracker: None
- Baseline: `168842cba79048d132153022b5af9d21f33134d8`

## Current State

The repository has accepted Specification, Plan, and Task contracts plus a dependency-free validator. GitHub Issue metadata is mandatory in Specifications and Tasks, the canonical chain starts at GitHub, and Task graph semantics are documented but not validated.

## Goal

Make repository artifacts independently executable by agents while retaining optional compatibility with GitHub references and existing artifacts.

## Affected Areas

- `AGENTS.md`, core agent rules, authority and contract documentation
- Specification, Plan, and Task templates and existing canonical chain declarations
- `scripts/ai-factory/validate.py` and its tests
- New Specification, ADR, Task, and verification evidence

## Architecture

ADR 0020 makes the repository the engineering system of record. The validator remains deterministic, dependency-free tooling and does not select work, generate prompts, or invoke agents.

## Database

None. No schema, migration, transaction, or application state changes.

## Implementation Sequence

1. Update authority, templates, and contracts so external trackers are optional.
2. Add deterministic Task graph validation and unit coverage.
3. Migrate existing canonical chain declarations without deleting valid external references.
4. Record verification evidence and prepare the reviewable change.

## Task Graph

```text
TASK-AI-001
```

The single Task is sequential and has no predecessor.

## Testing Strategy

- Unit-test optional and malformed Issue metadata.
- Unit-test missing, unfinished, and cyclic Task dependencies.
- Run repository-wide artifact validation to prove backward compatibility.

## Verification Strategy

Run the validator, validator unit suite, Python compilation, and diff whitespace validation. Inspect the final diff for runtime product changes.

## Risks

- Stale documentation could continue implying mandatory orchestration; repository search detects remaining normative language.
- Over-strict graph parsing could reject existing Tasks; migrate only declarations that are not canonical Task dependencies.
- This PR must not delete the orchestrator before a direct harness contract exists.

## Dependencies

- Human acceptance of the optimized removal plan: satisfied.
- `SPEC-0009` Accepted: satisfied.
- Baseline commit available locally: satisfied.

## Stop Conditions

- Stop if the change requires product runtime, database, deployment, or dependency modifications.
- Stop if existing external Issue references would need to be deleted rather than made optional.
- Stop if a dependency rule cannot be enforced deterministically.

## Definition of Done

The canonical chain is project-local, Issue metadata is optional, graph failures are tested, existing artifacts validate, the diff contains no application changes, and verification evidence is recorded.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Specification: `SPEC-0009` v1
- Plan: `PLAN-0006` v1
- Task: `TASK-AI-001`
- PR: pending
- Verification/Convergence: `docs/verification/ai-engineering-contract-v1.md`
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready implementation plan for the project-local contract — 2026-09-08
