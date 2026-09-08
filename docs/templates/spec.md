---
id: SPEC-EXAMPLE-001
status: Proposed
version: 1
owner: "team"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# SPEC-EXAMPLE-001 — Title

## Status

`Proposed` | `Accepted` | `Superseded`

A material Specification becomes authoritative for implementation only when its status is `Accepted`.

## Problem

Describe the observable problem or unmet requirement. Do not prescribe implementation.

## Goal

Describe the measurable outcome that must become true.

## Actors

Identify users, internal services, external providers, scheduled jobs, or administrative actors involved.

## Scope

Explicitly describe what behavior is included.

## Non-goals

Explicitly describe behavior that is not part of this change. Non-goals prevent agents from expanding scope by assumption.

## Business Rules

Number material rules so they can be referenced by plans, tasks, tests, and convergence checks.

- `BR-01`: ...
- `BR-02`: ...

## Invariants

Reference canonical invariant IDs only. Do not redefine an existing invariant in a way that conflicts with `docs/domain/invariants.md`.

- `INV-...`

## State Transitions

Document lifecycle transitions when applicable. State transitions must identify allowed, forbidden, and terminal states.

```text
STATE_A → STATE_B
STATE_B → STATE_C
```

## API / Data Contract

Describe externally observable requests, responses, events, persistence, schema changes, or compatibility requirements when applicable.

For each public contract, specify required fields, constraints, ownership, and error semantics. Reference OpenAPI/Prisma artifacts when they become the implementation source.

## Concurrency Model

Describe race conditions, transaction boundaries, uniqueness constraints, isolation assumptions, optimistic/pessimistic controls, and retry semantics whenever state can be changed concurrently.

## Failure Modes

Describe timeout, duplicate request/event, retry, process crash, partial completion, provider failure, recovery, and reconciliation behavior as applicable.

## Security

Describe trust boundaries, authentication, authorization, validation, sensitive data, secret handling, abuse/rate-limit requirements, and external callback authenticity.

## Observability

Define logs, metrics, traces, correlation identifiers, and operational signals needed to prove or operate the behavior. Avoid sensitive data.

## Backward Compatibility

Describe compatibility with existing clients, data, APIs, schemas, migrations, or operational behavior. State whether a migration, rollout strategy, or deprecation is required.

## Acceptance Criteria

Acceptance criteria define the observable contract. Every material criterion must be independently verifiable and should identify its evidence class.

- [ ] `AC-01` — ... **Evidence:** test | static check | integration | runtime | manual review
- [ ] `AC-02` — ... **Evidence:** ...

### Acceptance rules

1. Criteria must describe observable outcomes, not implementation steps.
2. Criteria must be deterministic enough for an independent verifier to judge.
3. Criteria must cover important failure and security behavior, not only the happy path.
4. A criterion is not accepted because a test passes when the test does not actually prove the criterion.

## Verification Strategy

Define the verification surface before implementation.

- Required commands/checks: `...`
- Unit tests: `...`
- Integration/concurrency tests: `...`
- Security/contract checks: `...`
- Runtime/manual checks: `...`
- Required external evidence: `...`

The final implementation must be traceable from each material acceptance criterion to evidence.

## Decisions / References

Reference relevant ADRs, current architecture, invariant catalog, provider documentation, prior accepted Specs, and other authoritative artifacts.

## Traceability

Material changes must preserve this chain:

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

### Traceability metadata

- External tracker: `#...` (optional)
- Spec: `SPEC-...`
- Plan: `PLAN-...`
- Tasks: `TASK-...`
- PR: `#...`
- Verification/Convergence: `...`
- Evaluation: `EVAL-...`
- Memory: `MEM-...`

When present, `source_issue` must use the canonical GitHub Issue reference format `#<number>`. The Specification remains authoritative without an external tracker.

## Change History

Record material changes to the Specification and why they occurred. A change to an accepted Spec requires re-evaluating downstream Plan/Task artifacts.

- `v1` — Initial proposal — YYYY-MM-DD
