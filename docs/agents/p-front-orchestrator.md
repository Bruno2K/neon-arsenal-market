# P-front orchestrator

Turns the frontend rebuild into a one-prompt loop that still obeys `AGENTS.md`.

This is a control-plane convention, not a new runtime and not part of the application architecture.

## Human loop

You do three things:

1. Tell a Cloud Agent: `next` (or `Execute the next P-front activity`).
2. Review the draft PR.
3. Merge. Repeat from 1.

Do not paste issue bodies. Do not write a custom prompt per activity. The repo already knows what is next.

## Agent loop

When the human says `next` / `execute next P-front activity`:

1. Read the mandatory agent docs (`AGENTS.md`, `docs/agents/*`, `docs/architecture/domain-invariants.md`).
2. Read `docs/frontend-sprint.md`.
3. Run `python3 scripts/p-front/next.py` (use `--json` if needed).
4. Implement **only** `next.id`.
5. Open a draft PR titled `[P-front] <ID> — <title>` from `cursor/p-front-<id>-ef90`.
6. Stop. Do not start the following activity in the same PR.

If `next.py` exits 2 (blocked on in-progress PRs), report the URLs and wait. Do not invent work.

If several activities are ready and the human asked for parallel sub-agents, launch one agent per ready item **only when `ownerFiles` do not overlap**. Default sequential pick is the first ready activity (S2 before A1/C1 when all three are ready, because it is listed first after F0.4).

## Prompt (reuse as-is)

```text
Execute the next unblocked P-front activity.

Run: python3 scripts/p-front/next.py --prompt
Then follow that printed prompt exactly.

Mandatory reading order still applies (AGENTS.md and docs/agents/*).
Do not edit server/. Do not add features. Do not merge. Do not close issues.
```

`python3 scripts/p-front/next.py --prompt` prints the scoped prompt for the current activity, including files, acceptance criteria, and verify commands.

## Roles

Use the smallest set from `docs/agents/roles.md`:

| Activity | Roles |
|---|---|
| F0.1 | Planner + Verification |
| F0.2 F0.3 F0.4 S1 | Implementation + Verification (+ Test when tests exist) |
| S2 S3 D1 Q2 | Implementation + Test + Verification |
| A1 C1 | Implementation + Security + Verification (+ Test for C1) |
| D2 Q1 Q3 | Implementation or Verification as listed in `activities.json` |

Do not invoke Database/Concurrency. Do not change payment or reservation semantics. C1 may fix dishonest checkout copy only.

## Isolation

- One activity, one branch, one PR.
- Owner files in `activities.json` are exclusive until that PR merges.
- Failure budget: the same root cause failing verification twice → HUMAN (`docs/agents/execution-protocol.md`).
- Handoff: `docs/agents/handoff-template.md`.

## Why not fifteen GitHub issues

The orchestrator contract says a GitHub issue is the usual intake. For this sprint the issue would only repeat `activities.json`. Duplicating that by hand is not required for correctness.

If GitHub tracking is wanted, create them in one command (`python3 scripts/p-front/create-issues.py`) on a write-capable machine. Agents still treat the files as source of truth.
