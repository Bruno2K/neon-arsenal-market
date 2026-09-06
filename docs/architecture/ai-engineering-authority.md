# AI Engineering Authority Model

## Purpose

Define how Neon Arsenal agents interpret and reconcile requirements, architecture decisions, invariants, implementation, tests, runtime evidence, and historical knowledge.

## Artifact hierarchy

```text
Intent
  ↓
Specification
  ↓
Plan
  ↓
Task
  ↓
Implementation
  ↓
Verification
  ↓
Evaluation
  ↓
Memory
```

GitHub Issues are the operational intake and tracking layer. They are not a substitute for a material Specification.

## Authority by concern

| Concern | Authoritative artifact | Rule |
|---|---|---|
| Business requirement | Specification | Defines what must be true and what is explicitly out of scope. |
| Architecture decision | ADR | Defines durable structural trade-offs and selected architecture. |
| Business invariant | Domain invariant catalog + tests/schema | Defines truths that must survive refactors, retries, races, and crashes. |
| Current implementation | Code | Describes executable behavior today; disagreement with docs is a defect to resolve, not permission to invent behavior. |
| Acceptance evidence | Tests/checks/runtime evidence | Proves whether a requirement is satisfied. |
| Operational learning | Engineering Memory | Reusable context; never overrides current code, spec, ADR, or invariant evidence automatically. |
| Agent procedure | `AGENTS.md` + `.cursor/rules/` | Defines how agents operate, not what product behavior should be. |

## Conflict resolution

1. Protect security, data integrity, and explicit business invariants.
2. Do not silently invent a requirement when artifacts disagree.
3. Inspect executable behavior and relevant tests to establish the current state.
4. For a material requirement conflict, escalate to HUMAN and record the decision.
5. Update the stale artifact in the same coherent change once the decision is made.

## Materiality rule

A Specification is required when a change affects business behavior, public API contracts, database schema/state, security guarantees, payment semantics, concurrency, reliability, architecture boundaries, or user-visible workflow beyond a trivial isolated fix.

Small reversible changes may use the existing Issue + task workflow until the specification threshold is triggered.

## Traceability

Material work should be traceable as:

`Issue → SPEC → PLAN → TASK(S) → PR → CONVERGENCE → EVALUATION`

Later phases may append `MEMORY` references to the chain.

## Non-goals

This document does not introduce microservices, queues, new databases, LLM-vendor dependencies, or a second orchestration system. The existing modular monolith remains the application architecture.
