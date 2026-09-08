---
id: PLAN-0008
status: Ready
version: 1
source_spec: SPEC-0009
source_spec_version: 1
baseline_revision: 7ad34cf1ff859115339913961b612269eaa65c9a
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [PLAN-0008] — Remove the legacy orchestrator

## Status

`Ready`

## Source

- Specification: `SPEC-0009` v1
- ADR: `ADR 0020`
- External tracker: None
- Baseline: `7ad34cf1ff859115339913961b612269eaa65c9a`

## Current State

The direct harness is canonical and validated, but the repository still contains the deprecated Issue selector, prompt generator, shell wrappers, P-back/P-front shims and catalogs, legacy tests, and operating documentation. Keeping executable legacy paths creates ambiguity and maintenance cost.

## Goal

Delete every executable and active-documentation surface of the old orchestrator while preserving the repository-native AI engineering artifacts and deterministic validation.

## Affected Areas

- Legacy scripts under `scripts/orchestrator/`, `scripts/p-back/`, and `scripts/p-front/`
- Shell wrappers under `scripts/`
- Legacy orchestrator and shim documents and Cursor rule
- Agent README/harness and root instructions
- Historical sprint/roadmap operating instructions
- Validator checks preventing legacy runtime reintroduction
- ADR implementation note and removal evidence

## Architecture

After removal there is no orchestration runtime or Issue-owned control plane. `AGENTS.md`, `docs/agents/harness.md`, repository artifacts, tests, and the validator form the complete harness. Git retains deleted history when needed.

## Database

None. No schema, migration, transaction, data, or application runtime change.

## Implementation Sequence

1. Add removal validation before deleting paths.
2. Remove runtime, wrappers, shims, legacy catalogs, issue-creation helpers, tests, docs, and provider rule.
3. Align active root, harness, sprint, roadmap, and ADR text with the final architecture.
4. Search for live references, run all artifact checks, and record evidence.

## Task Graph

```text
TASK-AI-001 → TASK-AI-002 → TASK-AI-003
```

The direct harness must be Done before legacy removal.

## Testing Strategy

Extend dependency-free validation to fail when any retired path exists. Unit-test the allowed removed state and rejection of a reintroduced runtime path. Run repository-wide artifact validation after deletion.

## Verification Strategy

Run Python compilation, artifact/harness validation, validator unit tests, focused live-reference search, Git diff checks, and commit-hook type checks.

## Risks

- A hidden wrapper could remain callable; explicit retired-path validation covers every known entry point.
- Deleting catalogs removes convenient snapshots; Git history and maintained sprint documents preserve historical evidence.
- Historical accepted artifacts mention the migration; those statements remain valid evidence and are not live interfaces.

## Dependencies

- `TASK-AI-002` Done: satisfied.
- Direct harness validation: satisfied.
- Human instruction to continue after PR #213 merge: satisfied.

## Stop Conditions

- Stop if a deleted path is used by product runtime, build, deployment, or a non-legacy check.
- Stop if Specifications, Plans, Tasks, ADRs, invariant catalogs, or verification history would be lost.
- Stop if product behavior changes.

## Definition of Done

All retired paths are absent, active instructions use only the direct harness, validation prevents reintroduction, checks pass, historical engineering artifacts remain, and no product runtime path changes.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Specification: `SPEC-0009` v1
- Plan: `PLAN-0008` v1
- Task: `TASK-AI-003`
- PR: pending
- Verification/Convergence: `docs/verification/legacy-orchestrator-removal-v1.md`
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready plan for physical legacy removal — 2026-09-08
