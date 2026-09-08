# Verification — Direct agent harness v1

## Scope

Verification of `PLAN-0007` and `TASK-AI-002` under `SPEC-0010`. The change establishes the provider-neutral repository harness and aligns active agent instructions without removing legacy files.

## Evidence

- `python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py` — passed with exit code 0.
- `python scripts/ai-factory/validate.py` — passed, including the direct harness, artifact contracts, Task graph, and internal references.
- `python scripts/ai-factory/test_validate.py` — 18 tests passed.
- `git diff --check` — passed with exit code 0 using the managed checkout's per-command safe-directory override.
- Focused instruction search — active Task execution, context, and execution-protocol files contain no mandatory `scripts/orchestrator/next.py` invocation. Remaining command references are explicitly marked legacy compatibility for PR3 removal.
- Changed-path review — no `src/`, `server/`, schema, migration, dependency, deployment, or infrastructure path changed.

## Acceptance mapping

- `TASK-AI-002 AC-01`: `docs/agents/harness.md` defines all four direct entry modes.
- `TASK-AI-002 AC-02`: deterministic harness validation rejects a legacy command in active execution guidance.
- `TASK-AI-002 AC-03`: manual review confirmed progressive context, role lenses, semantic parallelism, adversarial verification, evidence, portability, and stop conditions.
- `TASK-AI-002 AC-04`: deterministic validation requires `.cursor/rules/06-orchestrator.mdc` to have `alwaysApply: false`.
- `TASK-AI-002 AC-05`: all repository artifact and unit checks pass with documentation/tooling-only paths.

## Result

`PASS`. A repository-capable agent can now begin from a Task, Plan, described problem, or `next` without GitHub intake or a Python prompt generator. The legacy runtime remains isolated for physical deletion in the next PR.
