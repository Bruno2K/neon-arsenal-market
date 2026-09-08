# Verification — Legacy orchestrator removal v1

## Scope

Verification of `PLAN-0008` and `TASK-AI-003` under `SPEC-0010`. The change removes the former orchestration system after the direct harness became canonical.

## Removed surfaces

- Main Python runtime and unit tests under `scripts/orchestrator/`.
- Shell entry points `scripts/next.sh`, `scripts/p-back-next.sh`, and `scripts/p-front-next.sh`.
- P-back/P-front shims, tests, JSON catalogs, and issue-creation helpers.
- Dedicated orchestrator/shim documents and Cursor rule.
- Active sprint and roadmap instructions that invoked the removed system.

All deletions remain recoverable through Git history.

## Evidence

- Exact retired-path check — all ten guarded paths were absent.
- `python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py` — passed with exit code 0.
- `python scripts/ai-factory/validate.py` — passed; templates, direct harness, artifacts, graph, and references were valid.
- `python scripts/ai-factory/test_validate.py` — 18 tests passed.
- `git diff --check` — passed with exit code 0 using the managed checkout's per-command safe-directory override.
- Preservation inventory before this evidence file: 9 Specifications, 8 Plans, 9 Tasks, 20 numbered ADRs, and 7 prior verification records remained.
- Changed-path review — no `src/`, `server/`, schema, migration, dependency manifest, infrastructure, or deployment path changed.

## Acceptance mapping

- `TASK-AI-003 AC-01`: filesystem inventory and deterministic retired-path validation prove every known live surface is absent.
- `TASK-AI-003 AC-02`: `AGENTS.md`, Cursor operating rules, agent README, harness, sprint archives, and roadmap now direct agents to repository artifacts.
- `TASK-AI-003 AC-03`: the harness unit test recreates `scripts/orchestrator/` in isolation and confirms rejection.
- `TASK-AI-003 AC-04`: repository artifact discovery and internal-reference validation pass; canonical artifact counts were preserved.
- `TASK-AI-003 AC-05`: the changed-path review contains only agent guidance, engineering artifacts, validator code, and retired tooling.

## Result

`PASS`. Neon Arsenal retains SDD, graph engineering, harness engineering, validation, verification, and memory while no longer containing an orchestration runtime or Issue-dependent execution path.
