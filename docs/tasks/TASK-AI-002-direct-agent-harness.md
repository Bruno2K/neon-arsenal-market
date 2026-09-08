---
id: TASK-AI-002
status: Done
version: 1
source_spec: SPEC-0010
source_spec_version: 1
source_plan: PLAN-0007
source_plan_version: 1
baseline_revision: a40539921540417b88c56eddf2eee0eee6575565
owner: Neon Arsenal Engineering
created: 2026-09-08
updated: 2026-09-08
---

# [TASK-AI-002] — Publish and enforce the direct agent harness

## Status

`Done`.

## Source

- Specification: `SPEC-0010` v1
- Plan: `PLAN-0007` v1
- ADR: `ADR 0020`
- External tracker: None

## Objective

Make the direct repository harness the unambiguous default workflow for any compatible coding agent.

## Scope

Create the harness contract, align active agent guidance, retain legacy orchestration only as explicitly requested compatibility, and add deterministic harness validation. Do not remove legacy files or change product code.

## Allowed Files

- `AGENTS.md`
- `.cursor/rules/01-task-execution.mdc`
- `.cursor/rules/06-orchestrator.mdc`
- `docs/agents/README.md`
- `docs/agents/context-policy.md`
- `docs/agents/execution-protocol.md`
- `docs/agents/harness.md`
- `docs/plans/PLAN-0007-direct-agent-harness.md`
- `docs/tasks/TASK-AI-002-direct-agent-harness.md`
- `docs/verification/direct-agent-harness-v1.md`
- `scripts/ai-factory/validate.py`
- `scripts/ai-factory/test_validate.py`

## Preconditions

`SPEC-0010` is Accepted, `PLAN-0007` is Ready, `TASK-AI-001` is Done, and the baseline resolves locally.

## Acceptance Criteria

- [x] `AC-01` The harness defines direct Task, Plan, request-shaping, and `next` entry modes. **Evidence:** static check
- [x] `AC-02` Active execution and context guidance no longer requires a GitHub Issue or orchestrator command. **Evidence:** test
- [x] `AC-03` Context loading, role selection, parallelism, verification, evidence, and stop conditions are provider-neutral and explicit. **Evidence:** manual review
- [x] `AC-04` The Cursor orchestrator rule is inactive by default and limited to explicitly requested legacy compatibility. **Evidence:** static check
- [x] `AC-05` Repository artifact validation and unit tests pass without product changes. **Evidence:** integration

## Dependencies

`TASK-AI-001`.

## Risks

Changing the meaning of `next` could surprise users accustomed to GitHub selection. The harness documents the direct semantics and retains explicit legacy invocation until PR3.

## Verification Command

```powershell
python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py; python scripts/ai-factory/validate.py; python scripts/ai-factory/test_validate.py; git diff --check
```

## Expected Evidence

- Direct harness headings and active-instruction constraints pass deterministic tests.
- Repository artifacts and Task graph validate.
- Changed paths exclude product runtime, database, migrations, and deployment.

## Stop Conditions

- Stop if direct execution requires a vendor API, secret, network call, or new dependency.
- Stop before deleting `scripts/orchestrator/`, shims, or historical documentation.
- Stop if product behavior would change.

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-08 — v1 — Direct harness implemented and verified.
