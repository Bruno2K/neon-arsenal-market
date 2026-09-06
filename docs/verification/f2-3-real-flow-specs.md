# F2.3 — Real-flow Specification evidence

Date: 2026-09-06. Baseline: main 0d43679825fdae49d5f13d46b808eaca363bb124.

## Authorization and reconciliation

Notion task: https://app.notion.com/p/3d3678e54c8d81bf8176cf35d6f2e53f — convert order idempotency, refresh-token family and favorites to Specs with numbered criteria and invariants. The fetched F2.2 page includes a later Done checkpoint for PR #174 despite its stale In Progress property. Fetched origin/main and its merge history independently confirm PR #174's merge commit. Its reported CI run was not independently retrieved here.

Local main was 199 commits behind and updated with git pull --ff-only origin main. Original feat/p0-order-idempotency at a3ffc20 remains intact, including its local-only commit. The existing .claude worktree was preserved. No force update or history rewrite occurred.

## Deliverable and scope

- SPEC-0002 → issue #5: retrospective order creation contract grounded in ADR 0003, service, controller, DTO, schema and integration test cases.
- SPEC-0003 → issue #57: retrospective refresh-family subset grounded in ADR 0015, repository conditional update, service transaction and security integration cases.
- SPEC-0004 → issue #106: proposed unimplemented feature, separating issue requirements from additional response/error choices and unresolved lifecycle decisions.

All remain Proposed pending human review. No runtime behavior, migration, orchestrator or accepted requirement changed. Specs are at docs/specs root because current validation and Issue resolution use non-recursive globbing. This avoids silently undiscoverable domain subdirectories.

## Executed evidence

- python scripts/ai-factory/validate.py: PASS after correcting the initial missing literal traceability chain.
- python scripts/ai-factory/test_validate.py: PASS, 3 tests.
- Direct resolve_spec_for_issue assertions against the real repository: #5 resolves uniquely to SPEC-0002; #57 to SPEC-0003; #106 to SPEC-0004 (unique match).
- git diff --check: PASS, including staged check.

An initial unittest discovery command failed because test_issue_spec.py imports pytest, which is not installed locally; it also exposed the traceability omission subsequently fixed. The full pytest resolver suite was not executed. The direct resolver smoke check above passed but does not replace that suite. Runtime integration and frontend test suites were not run. After npm ci --prefix server and Prisma Client regeneration (no database migration), backend typecheck passed under bundled Node v24.19.0. Focused orders.service, orders.controller and auth.service unit suites passed: 3 files, 46 tests. The first commit hook passed frontend typecheck but failed backend typecheck against stale dependencies/generated Prisma; this was corrected without disabling hooks. Integration references remain verification maps, not executed concurrency evidence.

## Review and remaining gates

Implementation-side review checked ownership, money, atomicity, retry/crash boundaries and Proposed status. Independent review is pending on the PR; this record does not claim self-verification satisfies that gate.

Refresh same-token races have existing integration cases; this document does not claim those prove all cross-token logout races. Favorites response shapes, repeated DELETE and non-ACTIVE/deleted listing policy need acceptance before implementation. Keep F2.3 pending review/merge and do not advance to F3 from these drafts.

## Lightweight evaluation and memory

The contract represents two existing backend flows and one intended product flow without conflating implemented behavior with acceptance. Practical limitation: nested Specs would escape current discovery; preserve flat files until recursive support is deliberately specified/tested. The GitHub connector works for reading source issues; local gh has no authenticated session. No credentials were copied or persisted.


