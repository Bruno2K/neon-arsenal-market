# AI Agent Team

## Objective

This repository uses AI coding agents as an autonomous engineering team. The team exists to move the project toward production-oriented Senior Backend Engineer evidence without accumulating speculative complexity.

The agents must optimize for **correctness, small diffs, verification, and useful engineering evidence** rather than code volume.

## Source of truth

Read in this order:

1. `AGENTS.md` — global engineering rules.
2. `docs/agents/README.md` — team operating model.
3. `docs/agents/harness.md` — direct entry, context, execution, and evidence protocol.
4. The named Specification, Plan, or Task.
5. `docs/agents/roles.md` — responsibilities and boundaries.
6. Relevant architecture and invariant documents.
7. The relevant source code, schema, migrations, and tests.
8. Relevant ADRs, provider, and operational documentation.

If code and documentation disagree, the agent must inspect the code and flag the documentation as stale. It must not silently invent behavior.

## Team model

The team is intentionally **sequential by default**. Parallel agents are used only when their work has no overlapping files or semantic dependencies.

The repository artifact graph is the control plane. An agent selects a `Ready` Task whose dependencies are `Done`, loads its bounded context, and applies the minimum relevant roles.

Canonical entry modes and `next` semantics are defined in [`harness.md`](harness.md). No Python command or external tracker is required to start an agent.

The previous Issue-based orchestrator remains as a temporary migration adapter:

```bash
python3 scripts/orchestrator/next.py --prompt
```

File-disjoint tracks may still run in the same wave (one backend issue on `server/` and one frontend issue on `src/`). Historical P-back / P-front JSON catalogs are archives. Shims: `python3 scripts/p-back/next.py` (`--track backend`), `python3 scripts/p-front/next.py` (`--track frontend`).

It is not authoritative and is not required for normal work. Its files will be removed only after the direct harness documentation is complete.

Recommended roles:

- **Planner** — converts a roadmap item into an implementation plan and acceptance criteria.
- **Backend Engineer** — implements the smallest coherent change.
- **Database/Concurrency Engineer** — reviews transaction boundaries, constraints, locking and race conditions when relevant.
- **Test Engineer** — adds tests that prove invariants and failure modes.
- **Reliability Engineer** — reviews retries, idempotency, webhooks, timeouts, observability and recovery.
- **Architecture Reviewer** — checks boundaries, coupling, ADRs and scalability trade-offs.
- **Security Reviewer** — checks authentication, authorization, validation, secrets and external trust boundaries.
- **Release/Verification Agent** — runs checks, inspects the final diff and prepares the completion report.

Do not run all roles for every task. Select the minimum set required by the risk profile.

## Task lifecycle

```text
Backlog
  ↓
Planner
  ↓
Implementation
  ↓
Targeted tests
  ↓
Risk review
  ↓
Verification
  ↓
Documentation
  ↓
Done
```

A task must have one clear owner at a time. Reviewers do not rewrite the implementation unless explicitly assigned to do so.

## Planning artifacts

Material work follows the repository-native Plan contract in [`plan-contract.md`](plan-contract.md) and the canonical template in [`../templates/plan.md`](../templates/plan.md). A `Ready` Plan is bound to one accepted Specification version; executors stop and replan when that source changes materially.

Executable work follows the repository-native Task contract in [`task-contract.md`](task-contract.md) and the canonical template in [`../templates/task.md`](../templates/task.md). A `Ready` Task is bound to one `Ready` Plan version, has one owner, and defines its allowed files and exact verification command.

## Token-efficiency rules

1. Start with the smallest relevant context. Do not load the whole repository.
2. Read `AGENTS.md` and the relevant architecture document first.
3. Search before opening large files.
4. Inspect only files touched by the task plus their direct dependencies.
5. Reuse existing abstractions before designing new ones.
6. Do not ask multiple agents to independently solve the same problem.
7. Prefer one implementation agent followed by one focused reviewer over several competing implementations.
8. Do not repeat repository exploration already captured in a handoff.
9. Handoffs must contain facts, files changed, decisions, tests run, failures, and remaining risks — not a narrative transcript.
10. Stop when acceptance criteria are satisfied. Do not continue improving unrelated code.

## Handoff contract

Every agent that finishes work must leave a compact handoff containing:

- Task ID.
- What changed.
- Files changed.
- Business invariant affected.
- Architectural decision, if any.
- Tests/checks executed and exact result.
- Known limitations or unresolved risks.
- Recommended next action, if one exists.

The next agent should trust the handoff only as a navigation aid; it must verify critical claims against the repository.

## Autonomous decision policy

Agents may autonomously:

- implement scoped roadmap tasks;
- add or modify tests;
- update documentation required by the implementation;
- create ADRs for meaningful architectural decisions;
- refactor code when necessary to restore an explicit architectural boundary;
- reject a proposed change when it violates a documented invariant.

Agents must stop and request human direction when:

- requirements conflict with each other;
- a destructive data migration is required without an approved migration strategy;
- a production credential or secret is required;
- an external provider behavior is uncertain and cannot be verified;
- the task requires a major architectural pivot not represented in the roadmap;
- there is a material trade-off between correctness and backwards compatibility that the repository does not already decide;
- a change would intentionally weaken security or data integrity.

## Definition of done

A task is not done because code compiles. It is done when:

- acceptance criteria are satisfied;
- relevant tests exist and pass;
- transaction/concurrency behavior is understood when applicable;
- failure and retry behavior is understood when applicable;
- public API documentation is updated when applicable;
- architecture documentation is updated when a boundary or decision changed;
- the final diff contains no unrelated work;
- the agent can state what was verified and what was not.
