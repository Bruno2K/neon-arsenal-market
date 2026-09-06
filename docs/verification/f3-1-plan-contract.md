# F3.1 — Plan contract evidence

Date: 2026-09-06. Baseline: `232c2922eca1eadc7deccf4d6509da0430566010`.

## Authorization and gate

The user explicitly authorized starting F3 after PR `#175` merged. The Notion F2.3 item was reconciled to Done with its merge evidence, and F3.1 was set to In Progress. This increment implements only F3.1: Plan contract plus one real example. F3.2 Task semantics and F3.3 planner automation remain outside the diff.

## Artifacts

- `docs/agents/plan-contract.md` defines authority, lifecycle, reproducibility, graph rules, completeness and validation limits.
- `docs/templates/plan.md` carries the canonical metadata and required sections.
- `PLAN-0001` v1 is a real Draft for customer favorites, bound to Proposed `SPEC-0004` v1 and the exact inspected Git revision. It demonstrates that planning may proceed for review while execution remains blocked.
- `scripts/ai-factory/validate.py` validates Plan structure, source lifecycle/version, and that the baseline resolves to a repository commit.
- `scripts/ai-factory/test_validate.py` contains focused lifecycle and regression cases.

## Executed evidence

- `python -m py_compile scripts/ai-factory/validate.py scripts/ai-factory/test_validate.py`: PASS.
- `python scripts/ai-factory/validate.py`: PASS; templates, IDs, Specification contracts, Plan contracts and internal references valid.
- `python scripts/ai-factory/test_validate.py`: PASS, 10 tests.
- `git diff --check`: PASS.

The first validator run found that a path such as `PLAN-0001-plan-contract...` was extracted as the invalid reference `PLAN-0001-`. F3.1 fixed reference extraction to trim path and prose punctuation suffixes, tightened canonical IDs to end in an alphanumeric character, and added a regression test. Verification review then found that substring checks accepted wrong-level, suffixed, or fenced headings; exact outside-fence matching and regression cases now close that gap. The checks above are after both corrections.

The repository commit hook passed client and server typechecks. PR `#176` is open; CI results are pending at this checkpoint. Runtime, frontend, database and PostgreSQL integration suites are not required by this documentation and dependency-free validator change.

## Review boundary

Structural validation cannot judge whether a decomposition is substantively correct. It now proves that a Ready Plan names an existing Accepted Specification at the matching numeric version, records a resolvable baseline commit, and contains exact canonical headings outside code fences. Draft Plans may explore Proposed Specifications but cannot authorize execution. The first architecture review rejected a self-authorizing Ready example based on `SPEC-0001`; the corrected example is Draft against `SPEC-0004`, defines no F3.2 Task metadata, and resolves revision history through immutable Ready IDs. The factory CI checkout fetches full history so committed baselines remain resolvable there.

## Remaining gate

Architecture and verification reviewers reported no remaining blockers after the corrections. F3.1 becomes Done only after CI passes and PR `#176` merges. Do not start F3.2 from this evidence alone.
