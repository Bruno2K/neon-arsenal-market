# Backend sprint — P-back

This is a **historical backend sprint archive**, not application architecture or an executable queue.

The backend is already a modular monolith (`server/src/modules/*`). This file is the **historical P-back sprint archive**, not the executable queue.

New work follows `docs/agents/harness.md` and repository-native Specifications, Plans, and Tasks. External Issues are optional references.

## Isolation

| Track | Owns | Must not touch |
|---|---|---|
| **backend** | `server/`, `server/prisma/`, backend tests, backend ADRs | `src/` (Vite client) |
| **frontend** | `src/`, frontend docs | `server/` |

Shared files (`docs/roadmap.md`, `AGENTS.md`, `docs/agents/`) may be updated **lightly** when an authoritative Task requires it.

## How to start the next activity

Name a `TASK-*`, continue a `PLAN-*`, describe the requested backend problem, or use direct `next` semantics from the harness. Task lifecycle and verification evidence determine completion; an external Issue or PR may add coordination context.

## Priority (why this order)

`AGENTS.md` priority is correctness → security → reliability → testability → observability → performance → maintainability → DX → features.

P0/P1 flagship work and the historical P-back catalog (through C2 skip) are already represented in repository history. ADR 0007 keeps Render. Remaining work comes from authoritative artifacts or an explicit human request; no Redis/SQS/AWS unless a later ADR supersedes 0007.

| ID | Title | Why now |
|---|---|---|
| **B0.1** | This contract | So `next` is deterministic |
| **R1** | Payment-link idempotency | `POST /payments` can create a second PayPal order on client retry; order creation already has `Idempotency-Key` |
| **R2** | Capture-after-expiry ops | Documented gap: capture after expiry has no refund/ops path. **Do not invent a PayPal refund API.** |
| **O1** | Render operations | Real production is Render (`render.yaml`), not ECS. Health vs ready, seed-on-boot, runbook. |
| **D1 / D2** | Threat model + C4 | Interview/ops docs listed on the roadmap and still missing |
| **C1** | Cloud target ADR | Human-facing architecture choice. Writes the ADR only. |
| **C2** | AWS/Terraform | **Only if C1 selected AWS.** If C1 keeps Render, land a skip commit so the queue can close. |

## Activity catalog (archive)

The table below preserves the human summary of the removed P-back catalog. Full machine history remains available in Git.

| ID | Title | Depends on |
|---|---|---|
| P0.1–P1.4 | Historical P0/P1 (legacy done on `main`) | chain |
| B0.1 | Orchestrator contract | — |
| R1 | Payment-link idempotency | B0.1, P0.3 |
| R2 | Capture-after-expiry ops | B0.1, P0.2 |
| O1 | Render runbook + health alignment | B0.1, P1.3 |
| D1 | Threat model | B0.1 |
| D2 | C4 diagrams | B0.1 |
| C1 | Cloud target ADR | O1, D1 |
| C2 | AWS/Terraform (conditional) | C1 |

## Rules for every activity

1. One activity, one branch, one PR.
2. Follow the Task's Git and external-communication boundaries.
3. Do not edit `src/`.
4. Do not introduce Redis, Kafka, RabbitMQ, SQS, or microservices.
5. Do not invent PayPal APIs, environment variables, or refund semantics. If a payment activity needs an undefined provider contract, stop and ask (`docs/agents/decision-policy.md`).
6. PostgreSQL remains the source of truth for transactional state.
7. Prefer the smallest correct change. Tests must prove the invariant, not merely increase coverage.

## Commit and PR convention (new work)

- Commit/PR: conventional commit plus a concise outcome.
- Branch: environment convention plus a concise lowercase slug.

Historical P-back commits used `[P-back] <ID>`.

## Prompt to reuse

```text
Execute the named backend TASK, or apply direct `next` semantics from docs/agents/harness.md.
Read only the Task's source artifacts and minimum relevant backend context.
Do not edit src/. Do not start AWS/Terraform unless a later ADR supersedes ADR 0007 and selects AWS.
Run the exact verification command and record evidence.
```
