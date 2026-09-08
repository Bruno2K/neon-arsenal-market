# Verification — Project-local AI engineering contract v1

## Scope

Verification of `SPEC-0010`, `PLAN-0009`, and `TASK-AI-001`. The change is limited to AI engineering artifacts, agent guidance, templates, and deterministic validation.

## Evidence

- `python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py` — passed with exit code 0.
- `python scripts/ai-factory/validate.py` — passed; templates, IDs, Specification, Plan, Task, Task graph, and internal references were valid.
- `python scripts/ai-factory/test_validate.py` — 17 tests passed.
- `git diff --check` — passed with exit code 0. The managed verification environment supplied the repository path through Git's per-command `safe.directory` setting because the checkout owner differs from the runner identity.
- Changed-path review — no `src/`, `server/`, database, migration, deployment, or application runtime paths changed.

## Acceptance mapping

- `SPEC-0010 AC-01` and `AC-02`: unit tests cover omitted and malformed `source_issue` for Specifications and Tasks.
- `SPEC-0010 AC-03`: unit tests cover missing, self, cyclic, and unfinished Task dependencies.
- `SPEC-0010 AC-04`: authority documents, contracts, templates, and existing artifacts use the project-local canonical chain.
- `SPEC-0010 AC-05`: repository-wide validation passes and the changed-path review confirms no product behavior change.

## Result

`PASS`. The repository contract no longer depends on GitHub intake, and the Task graph has deterministic structural enforcement. The legacy orchestrator remains available only as a deprecated migration adapter; direct harness documentation and physical removal remain separate reviewable changes.
