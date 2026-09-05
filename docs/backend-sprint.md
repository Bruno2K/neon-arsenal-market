# Backend sprint — P-back

This is the **backend control plane**, not application architecture.

The backend is already a modular monolith (`server/src/modules/*`). This file is the **historical P-back sprint archive**, not the executable queue.

Work is selected from **GitHub issues** by the unified orchestrator:

```bash
python3 scripts/orchestrator/next.py --track backend
```

`python3 scripts/p-back/next.py` is a shim. Do not add a second runtime orchestrator to the application.

## Isolation

| Track | Owns | Must not touch |
|---|---|---|
| **backend** | `server/`, `server/prisma/`, backend tests, backend ADRs | `src/` (Vite client) |
| **frontend** | `src/`, frontend docs | `server/` |

Shared files (`docs/roadmap.md`, `AGENTS.md`, `docs/agents/`) may be updated **lightly** when a GitHub issue requires it.

## How to start the next activity

```bash
python3 scripts/orchestrator/next.py --track backend --prompt
```

Then spawn the printed subagent. The machine-readable equivalent is `python3 scripts/orchestrator/next.py --json --track backend`.

Done detection: the GitHub issue is closed, or `origin/main` already contains equivalent work (orchestrator `likelyDone`). Busy detection: an **open** GitHub PR that references the issue.

## Priority (why this order)

`AGENTS.md` priority is correctness → security → reliability → testability → observability → performance → maintainability → DX → features.

P0/P1 flagship work and the P-back catalog (through C2 skip) are already on `main`. ADR 0007 keeps Render. Remaining backend work is whatever **open GitHub issues** survive orchestrator gates (no Redis/SQS/AWS unless a later ADR supersedes 0007).

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

The completed sprint graph is `scripts/p-back/activities.json`. It is **not** orchestrator intake. Human summary:

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
2. Do not merge the PR. Do not close GitHub issues (`gh` is read-only in this environment).
3. Do not edit `src/`.
4. Do not introduce Redis, Kafka, RabbitMQ, SQS, or microservices.
5. Do not invent PayPal APIs, environment variables, or refund semantics. If a payment activity needs an undefined provider contract, stop and ask (`docs/agents/decision-policy.md`).
6. PostgreSQL remains the source of truth for transactional state.
7. Prefer the smallest correct change. Tests must prove the invariant, not merely increase coverage.

## Commit and PR convention (new work)

- Commit/PR: `#{issue} — <short description>`
- Branch: `cursor/issue-<n>-<slug>` (lowercase)

Historical P-back commits used `[P-back] <ID>`.

## Prompt to reuse

```text
Execute the next unblocked backend GitHub issue.
Run: python3 scripts/orchestrator/next.py --track backend --prompt
Then spawn the printed subagent. Do not implement in the parent.
Do not edit src/. Do not start AWS/Terraform unless a later ADR supersedes ADR 0007 and selects AWS.
Do not merge. Do not close issues.
```
