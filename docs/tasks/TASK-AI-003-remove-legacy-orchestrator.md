---
id: TASK-AI-003
status: Done
version: 1
source_spec: SPEC-0009
source_spec_version: 1
source_plan: PLAN-0008
source_plan_version: 1
baseline_revision: 7ad34cf1ff859115339913961b612269eaa65c9a
owner: Neon Arsenal Engineering
created: 2026-09-08
updated: 2026-09-08
---

# [TASK-AI-003] — Remove every legacy orchestrator surface

## Status

`Done`.

## Source

- Specification: `SPEC-0009` v1
- Plan: `PLAN-0008` v1
- ADR: `ADR 0020`
- External tracker: None

## Objective

Remove the deprecated orchestrator runtime and all of its executable, provider-rule, catalog, test, and active-documentation surfaces.

## Scope

Delete the old orchestrator system, align maintained guidance with the direct harness, and enforce absence through deterministic validation. Preserve all canonical SDD, graph, harness, verification, evaluation, and memory artifacts.

## Allowed Files

- `AGENTS.md`
- `.cursor/rules/00-agent-operating-system.mdc`
- `.cursor/rules/01-task-execution.mdc`
- `.cursor/rules/06-orchestrator.mdc` (delete)
- `docs/adr/0020-project-local-ai-engineering.md`
- `docs/agents/README.md`
- `docs/agents/harness.md`
- `docs/agents/roles.md`
- `docs/agents/orchestrator.md` (delete)
- `docs/agents/p-back-orchestrator.md` (delete)
- `docs/agents/p-front-orchestrator.md` (delete)
- `docs/backend-sprint.md`
- `docs/frontend-sprint.md`
- `docs/roadmap.md`
- `docs/plans/PLAN-0008-remove-legacy-orchestrator.md`
- `docs/tasks/TASK-AI-003-remove-legacy-orchestrator.md`
- `docs/verification/legacy-orchestrator-removal-v1.md`
- `scripts/ai-factory/validate.py`
- `scripts/ai-factory/test_validate.py`
- `scripts/orchestrator/**` (delete)
- `scripts/p-back/**` (delete)
- `scripts/p-front/**` (delete)
- `scripts/next.sh` (delete)
- `scripts/p-back-next.sh` (delete)
- `scripts/p-front-next.sh` (delete)

## Preconditions

`SPEC-0009` is Accepted, `PLAN-0008` is Ready, `TASK-AI-002` is Done, and the direct harness validates at the baseline.

## Acceptance Criteria

- [x] `AC-01` The orchestrator runtime, wrappers, shims, catalogs, issue helpers, tests, legacy docs, and provider rule are absent. **Evidence:** static check
- [x] `AC-02` Active root and agent guidance expose only the direct repository harness. **Evidence:** static check
- [x] `AC-03` Deterministic validation rejects reintroduction of a retired path. **Evidence:** test
- [x] `AC-04` Canonical Specifications, Plans, Tasks, ADRs, invariants, verification, evaluation, and memory remain intact. **Evidence:** integration
- [x] `AC-05` Product runtime, database, dependencies, infrastructure, and deployment remain unchanged. **Evidence:** manual review

## Dependencies

`TASK-AI-002`.

## Risks

Historical documents may truthfully mention that the orchestrator once existed. Validation distinguishes immutable history from live paths and instructions.

## Verification Command

```powershell
python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py; python scripts/ai-factory/validate.py; python scripts/ai-factory/test_validate.py; git diff --check
```

## Expected Evidence

- All retired filesystem paths are absent and guarded by tests.
- Maintained instructions point only to `docs/agents/harness.md`.
- Artifact, harness, graph, and reference validation passes.
- No product or deployment path changes.

## Stop Conditions

- Stop if any target participates in product runtime, CI build, deployment, or artifact authority.
- Stop before deleting canonical engineering artifacts or unrelated code.
- Stop if removal requires replacement runtime infrastructure.

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-08 — v1 — Physical removal completed and verified after direct harness completion.
