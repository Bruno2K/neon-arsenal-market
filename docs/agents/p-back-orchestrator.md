# P-back orchestrator

P-back is a **control-plane loop**, not a second application orchestrator.

The backend remains a modular monolith. This document defines how a Cursor/cloud agent picks and executes the next backend sprint activity without colliding with P-front.

## Why this exists

P-front already has `docs/agents/p-front-orchestrator.md` + `scripts/p-front/next.py`. Backend work was still driven by ad-hoc roadmap reading, which made it easy to jump to P2 AWS after P1.4.

`AGENTS.md` priority and `docs/agents/decision-policy.md` say:

- correctness / reliability before cloud collecting
- switching Render → ECS is a **human** architecture decision
- do not invent provider contracts

The catalog encodes that order so `next` cannot select Terraform before the cloud ADR.

## Isolation

| Agent | Allowed | Forbidden |
|---|---|---|
| P-back | `server/`, backend docs, `docs/backend-sprint.md`, `scripts/p-back/` | `src/`, `scripts/p-front/` |
| P-front | `src/`, frontend docs, `scripts/p-front/` | `server/` |

Disjoint paths mean the two tracks can run in parallel on separate branches. Do not “help” the other track.

## Loop

```text
1. python3 scripts/p-back/next.py --prompt
2. Create branch cursor/p-back-<id>-<suffix> from origin/main
3. Implement only that activity's ownerFiles / invariants
4. Commit with [P-back] <ID> in the subject
5. Open one PR whose title contains [P-back] <ID>
6. Stop. Do not merge. Do not start the next activity on the same branch.
```

`next.py` will treat the activity as **busy** while that PR is open, and **done** after the commit is on `origin/main`.

## Detection

| State | Source | Default marker |
|---|---|---|
| done | `git log origin/main --pretty=%s` | `[P-back] <ID>` |
| busy | `gh pr list --state open` titles | `[P-back] <ID>` |

Exceptions live on the activity object:

- `legacyDone: true` — already on `main` under old commit subjects (P0.1–P1.3)
- `doneMarkers` / `busyMarkers` — extra substrings (P1.4 landed as `P1.4: Performance evidence...`)

## Selecting the next activity

Walk `scripts/p-back/activities.json` in array order. The next activity is the first one that is:

1. not done
2. not busy
3. every `dependsOn` id is done

If every remaining activity is busy, `next.py` exits 2 (blocked). If the catalog is complete, exit 0 with `QUEUE_COMPLETE`.

## `next` disambiguation

| Context | Command |
|---|---|
| Backend / P-back conversation | `python3 scripts/p-back/next.py` |
| Frontend / P-front conversation | `python3 scripts/p-front/next.py` |
| Unqualified `next` on a **backend** agent | P-back only. Do not run the frontend catalog. |

## What this orchestrator must not do

- Must not add Kafka, Redis, SQS, or a workflow engine to the application.
- Must not implement AWS/Terraform until activity **C2**, and only if **C1** selected AWS.
- Must not invent PayPal refund or capture APIs.
- Must not close GitHub issues (read-only `gh` in this environment).
- Must not merge PRs.

## Human gates

Stop and ask when `docs/agents/decision-policy.md` requires it, including:

- undefined PayPal refund/capture-after-expiry semantics (R2)
- Render vs ECS (C1) — the ADR is the artifact; the choice is human
- destructive migrations, auth weakening, deleting constraints
