---
id: SPEC-0010
status: Accepted
version: 1
owner: "Neon Arsenal Engineering"
created: 2026-09-08
updated: 2026-09-08
---

# [SPEC-0010] — Project-local AI engineering contract

## Status

`Accepted`

## Problem

The AI workflow currently treats GitHub Issues and an orchestrator runtime as required entry points even though the durable requirements, plans, tasks, evidence, and learning already live in the repository. This adds indirection, token cost, and coupling to one execution environment.

## Goal

Make the repository-native artifact system sufficient for any compatible coding agent to understand, select, execute, verify, and close work without requiring GitHub intake or a dedicated LLM orchestrator.

## Actors

- Human requester
- Any coding agent able to read the repository
- Independent reviewer or verification agent
- Optional external tracker

## Scope

- Make external Issue references optional.
- Establish Specification as the first canonical traceability node for material work.
- Validate the Task dependency graph statically.
- Record the architectural decision to prefer project-local artifacts over a custom orchestration runtime.

## Non-goals

- Removing the existing orchestrator files in this change.
- Rewriting product code or changing runtime behavior.
- Adding an agent API, MCP server, vector database, scheduler, or new service.
- Requiring every small and reversible change to have a Specification.

## Business Rules

- `BR-01`: Material work is authorized by an accepted Specification, not by an external tracker.
- `BR-02`: Plans and Tasks remain stored with the project they describe.
- `BR-03`: `source_issue` is optional metadata; when supplied, its canonical `#<number>` format remains validated.
- `BR-04`: Task dependencies use canonical `TASK-*` IDs or `None`.
- `BR-05`: A Task in `Ready`, `InProgress`, or `Done` may depend only on Tasks in `Done`.
- `BR-06`: The Task dependency graph must be acyclic and contain no missing or self references.

## Invariants

- `AI-ARTIFACT-001`: Canonical artifact IDs remain unique.
- `AI-ARTIFACT-002`: Material implementation remains traceable to its authoritative Specification.
- `AI-ARTIFACT-003`: Agent memory cannot override current authoritative artifacts.

## State Transitions

The existing Specification, Plan, and Task lifecycles remain unchanged. This contract changes intake authority, not artifact lifecycle states.

## API / Data Contract

Specification and Task frontmatter no longer require `source_issue`. If present, it must match `#<number>`. Canonical material traceability is:

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

The `## Dependencies` section of every Task contains one or more canonical Task IDs or `None`.

## Concurrency Model

The graph is a static directed acyclic graph. Parallel execution remains allowed only for Tasks whose declared write scopes and semantic dependencies do not overlap. Static validation proves ordering integrity but does not itself prove that parallel scopes are safe.

## Failure Modes

- Missing dependency: validation fails before execution.
- Self-dependency or cycle: validation fails before execution.
- Executable Task with unfinished dependency: validation fails.
- Missing external Issue: no failure; repository artifacts remain sufficient.
- Conflicting artifact authority: execution stops for human resolution.

## Security

Project artifacts must not contain credentials or secrets. Removing a runtime orchestrator reduces the number of components that could receive repository context, but does not replace least-context and secret-handling rules.

## Observability

Validation output records whether Specification, Plan, Task, graph, and reference contracts passed. Material execution continues to record exact verification evidence in repository artifacts.

## Backward Compatibility

Existing valid `source_issue` values remain accepted. Existing Issue-based workflows may continue as optional adapters. Product runtime, database, API, and deployment behavior are unchanged.

## Acceptance Criteria

- [ ] `AC-01` A valid Specification and Task can omit `source_issue`. **Evidence:** test
- [ ] `AC-02` A supplied malformed `source_issue` is rejected. **Evidence:** test
- [ ] `AC-03` Missing, self, cyclic, or unfinished Task dependencies are rejected according to lifecycle rules. **Evidence:** test
- [ ] `AC-04` Repository authority and templates use the project-local traceability chain. **Evidence:** static check
- [ ] `AC-05` Existing valid artifacts and application behavior remain compatible. **Evidence:** integration

## Verification Strategy

- Run `python scripts/ai-factory/validate.py`.
- Run `python scripts/ai-factory/test_validate.py`.
- Run `git diff --check`.
- Inspect the diff for product-runtime changes; none are permitted.

## Decisions / References

- `docs/adr/0020-project-local-ai-engineering.md`
- `docs/architecture/ai-engineering-authority.md`
- `docs/agents/plan-contract.md`
- `docs/agents/task-contract.md`

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Specification: `SPEC-0010` v1
- Plan: `PLAN-0009` v1
- Task: `TASK-AI-001`
- PR: pending
- Verification/Convergence: `docs/verification/ai-engineering-contract-v1.md`
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Accepted project-local contract after human review of the optimized migration plan — 2026-09-08
