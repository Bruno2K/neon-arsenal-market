---
id: TASK-AI-001
status: Done
version: 1
source_spec: SPEC-0009
source_spec_version: 1
source_plan: PLAN-0006
source_plan_version: 1
baseline_revision: 168842cba79048d132153022b5af9d21f33134d8
owner: Neon Arsenal Engineering
created: 2026-09-08
updated: 2026-09-08
---

# [TASK-AI-001] — Establish the project-local artifact and graph contract

## Status

`Done`.

## Source

- Specification: `SPEC-0009` v1
- Plan: `PLAN-0006` v1
- External tracker: None

## Objective

Make the repository-native artifact chain and validated Task graph sufficient without mandatory GitHub intake or an orchestration runtime.

## Scope

Update AI engineering documentation, templates, existing traceability declarations, deterministic validation, and validator tests. Do not remove orchestrator files or change product behavior.

## Allowed Files

- `AGENTS.md`
- `.cursor/rules/00-agent-operating-system.mdc`
- `docs/adr/0020-project-local-ai-engineering.md`
- `docs/agents/**`
- `docs/architecture/ai-engineering-authority.md`
- `docs/plans/**`
- `docs/specs/**`
- `docs/tasks/**`
- `docs/templates/**`
- `docs/verification/**`
- `scripts/ai-factory/validate.py`
- `scripts/ai-factory/test_validate.py`

## Preconditions

`SPEC-0009` is Accepted, `PLAN-0006` is Ready, and the baseline commit resolves locally.

## Acceptance Criteria

- [x] `AC-01` Specifications and Tasks accept omitted `source_issue` while validating a supplied reference. **Evidence:** test
- [x] `AC-02` Task dependency validation rejects missing nodes, cycles, and executable ordering violations. **Evidence:** test
- [x] `AC-03` Canonical authority and templates use the repository-native traceability chain. **Evidence:** static check
- [x] `AC-04` Existing repository artifacts pass validation after migration. **Evidence:** integration
- [x] `AC-05` No application runtime, database, or deployment file changes. **Evidence:** manual review

## Dependencies

None.

## Risks

Documentation may retain transitional references to the still-present orchestrator. Those references are removed in later PRs; this Task changes authority without prematurely deleting compatibility code.

## Verification Command

```powershell
python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py; python scripts/ai-factory/validate.py; python scripts/ai-factory/test_validate.py; git diff --check
```

## Expected Evidence

- Validator reports all artifact and graph contracts valid.
- Unit tests prove optional Issue metadata and graph failure cases.
- Git diff whitespace check succeeds.
- Changed paths remain within `Allowed Files` and exclude product runtime.

## Stop Conditions

- Stop if compatibility requires deleting existing valid Issue references.
- Stop if deterministic validation would need an LLM, network call, or new dependency.
- Stop before removing the orchestrator runtime in this PR.

## Traceability

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Change History

- 2026-09-08 — v1 — Contract implemented and verified.
