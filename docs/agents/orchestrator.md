# Agent Orchestrator Contract

## Purpose

The orchestrator is an engineering control plane around the repository. It coordinates scoped AI-agent work without becoming part of the Neon Arsenal application architecture.

Its job is to turn a GitHub issue into a controlled engineering execution: select context, assign roles, isolate changes, run verification, and produce durable evidence.

## Source of truth

The orchestrator must load and respect, in order:

1. `AGENTS.md`
2. `docs/agents/README.md`
3. `docs/agents/roles.md`
4. `docs/agents/context-policy.md`
5. `docs/agents/decision-policy.md`
6. `docs/agents/execution-protocol.md`
7. relevant architecture and invariant documents
8. the GitHub issue and acceptance criteria
9. relevant source, schema, migrations, and tests
10. ADRs and operations documentation when required

Code and executable behavior remain authoritative when documentation is stale.

## Core flow

```text
GitHub Issue
    ↓
Context selection
    ↓
Planner
    ↓
Implementation brief
    ↓
Isolated implementation
    ↓
Targeted tests
    ↓
Risk-based reviewers
    ↓
Independent verification
    ↓
PASS → PR / DONE
FAIL → implementation
BLOCKED → human decision
```

## Responsibilities

### 1. Intake

- Read the issue and classify risk.
- Identify required roles from the review matrix.
- Reject work that is underspecified or conflicts with project rules.

### 2. Context control

- Load the minimum context required for correctness.
- Prefer search and targeted file ranges over broad repository dumps.
- Preserve a compact implementation brief as the main handoff artifact.

### 3. Isolation

Implementation must happen on an isolated branch or worktree. Agents must not concurrently modify the same semantic scope unless an explicit coordination strategy exists.

### 4. Verification

Verification must be independent from implementation reasoning where practical. It checks the diff, acceptance criteria, invariants, tests, and repository state rather than trusting an agent's claim that the task is complete.

### 5. Evidence

A completed task must leave durable evidence:

- changed files
- tests/checks executed
- results
- invariant preserved
- important decisions
- known risks
- next action, if incomplete

## Risk-based role selection

| Work | Roles |
|---|---|
| Simple bug | Backend + Verification |
| API change | Backend + Test + Security when relevant + Verification |
| DB/concurrency | Backend + DB/Concurrency + Test + Verification |
| Reservation/order lifecycle | Backend + DB/Concurrency + Test + Verification |
| Payment/webhook | Backend + Reliability + Security + Test + Verification |
| Background job | Backend + Reliability + Test + Verification |
| Architecture | Planner + Backend + Architecture + Test + Verification |
| Cloud/infra | Planner + Infra/Backend + Security + Reliability + Verification |

Do not invoke every role for every task.

## State model

The orchestrator follows the execution protocol:

`READY → PLANNING → IMPLEMENTING → TESTING → REVIEWING → VERIFYING`

- `PASS` → `DONE`
- `FAIL` → `IMPLEMENTING`
- `BLOCKED` → `HUMAN`

A task that fails verification twice for the same root cause should escalate to a human instead of consuming an unbounded failure loop.

## Parallelism

Parallel execution is allowed only when scopes and invariants are independent. Examples include independent documentation sections or separate read-only reviews.

Do not parallelize:

- edits to the same file
- competing schema changes
- conflicting lifecycle semantics
- implementation and verification of the same uncommitted state

## Human escalation

Escalate before implementation when the task requires:

- destructive or irreversible data changes without a validated migration strategy
- secrets or credentials
- authentication or authorization weakening
- unknown external-provider behavior
- undefined payment semantics
- deletion of constraints or data
- introduction of speculative distributed infrastructure
- a modular-monolith to microservices pivot
- a material compatibility or correctness trade-off
- contradictory requirements

The escalation should state the decision required, known facts, options, risks, and the recommended option.

## Runtime independence

This document defines the contract, not a specific implementation technology. The orchestrator may eventually be implemented as a CLI, GitHub Action, service, or agent workflow. The repository must not depend on a particular LLM vendor or runtime to preserve these engineering rules.

## Non-goals

The orchestrator must not:

- replace normal CI
- hide failing tests
- bypass branch protections
- silently change requirements
- invent APIs, environment variables, or provider contracts
- add infrastructure merely to demonstrate sophistication
- turn every ticket into a multi-agent ceremony

## Definition of done

The orchestrator considers work complete only when the acceptance criteria are met, relevant tests/checks pass, required reviews are satisfied, no escalation remains unresolved, and a compact handoff/evidence record exists.