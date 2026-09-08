---
id: PLAN-0007
status: Ready
version: 1
source_spec: SPEC-0009
source_spec_version: 1
baseline_revision: a40539921540417b88c56eddf2eee0eee6575565
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [PLAN-0007] — Define the direct agent harness

## Status

`Ready`

## Source

- Specification: `SPEC-0009` v1
- ADR: `ADR 0020`
- External tracker: None
- Baseline: `a40539921540417b88c56eddf2eee0eee6575565`

## Current State

The repository artifact chain and Task graph are authoritative and validated. Active execution and context documents still contain mandatory orchestrator and GitHub intake instructions, so an agent can receive contradictory guidance despite ADR 0020.

## Goal

Publish one provider-neutral direct harness and align active agent instructions so repository-capable agents can resolve, execute, verify, and hand off work without the orchestrator.

## Affected Areas

- `docs/agents/harness.md`, README, context and execution protocols
- Root `AGENTS.md` direct-entry guidance
- Cursor task/orchestrator compatibility rules
- Factory validation and tests for the harness document contract
- Plan, Task, and verification evidence for this change

## Architecture

The harness is documentation plus deterministic validation, not a runtime service. `AGENTS.md` is the portable root entry point; provider-specific rules adapt it without gaining authority.

## Database

None. No product runtime, schema, migration, transaction, or persistence change.

## Implementation Sequence

1. Define direct entry modes, artifact resolution, context budget, execution loop, roles, parallelism, evidence, portability, and stop conditions.
2. Replace active Issue/orchestrator-first instructions with direct Task/Plan/Specification resolution.
3. Demote the Cursor orchestrator rule to explicit legacy compatibility.
4. Validate the harness shape and repository artifacts, then record evidence.

## Task Graph

```text
TASK-AI-001 → TASK-AI-002
```

`TASK-AI-002` begins after the project-local contract is Done.

## Testing Strategy

Add dependency-free checks for required harness headings, direct-mode language, and the absence of mandatory orchestrator invocation from active execution instructions.

## Verification Strategy

Run Python compilation, artifact validation, validator tests, focused searches for stale active instructions, and Git diff checks. Commit hooks provide client/server type checks.

## Risks

- Ambiguous `next` could silently choose the wrong work; the harness chooses only when eligibility and priority are unambiguous.
- Provider-specific rules could contradict portable authority; their scope is explicitly subordinate.
- Removing legacy files here would mix behavioral migration with deletion; physical removal remains PR3.

## Dependencies

- `SPEC-0009` Accepted: satisfied.
- `TASK-AI-001` Done: satisfied.
- ADR 0020 Accepted: satisfied.

## Stop Conditions

- Stop if the harness requires a model API, network service, credential, scheduler, or new dependency.
- Stop before deleting legacy orchestrator files.
- Stop if an active instruction cannot be reconciled without changing product behavior.

## Definition of Done

The direct harness is canonical, active instructions no longer require Issues or the orchestrator, portability and context budgets are explicit, deterministic checks pass, and no product runtime paths change.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Specification: `SPEC-0009` v1
- Plan: `PLAN-0007` v1
- Task: `TASK-AI-002`
- PR: pending
- Verification/Convergence: `docs/verification/direct-agent-harness-v1.md`
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready plan for a provider-neutral direct harness — 2026-09-08
