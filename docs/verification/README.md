# Verification evidence index

This directory preserves evidence from completed engineering work. It is not the current verification procedure and no file here authorizes new execution. The live repository procedure is `docs/agents/verification.md`, whose canonical entrypoint is `python scripts/verify.py`; product behavior remains authoritative in current Specifications, ADRs, invariants, code, and tests.

Evidence records are point-in-time claims. Commands, dependency findings, baselines, and operational observations describe the revision and environment named in each record unless a current authority independently confirms them.

## Durable portfolio evidence

These records remain useful maps from important engineering claims to implementation, tests, or operational reasoning:

- [`production-operational-proof-2026-09-15.md`](production-operational-proof-2026-09-15.md) — PR12 bounded production topology, health/readiness, signals, SLO targets, game days, recovery, backup posture, security review, and readiness evidence.
- [`final-senior-backend-audit-2026-09-14.md`](final-senior-backend-audit-2026-09-14.md) — PR11 final adversarial Senior Backend credibility audit: full PASS/P0/P1/P2 findings matrix, human policy gate, and regression evidence for every P0 fix.
- [`rate-limit-and-vulnerability-policy.md`](rate-limit-and-vulnerability-policy.md) — Render client-identity and dependency-policy evidence.
- [`refund-reconciliation-operations.md`](refund-reconciliation-operations.md) — refund recovery, idempotency, ledger compensation, and operations evidence.
- [`single-checkout-currency.md`](single-checkout-currency.md) — BRL checkout invariant and migration evidence.

The reviewer-facing claim-to-proof map is [`docs/portfolio/evidence-index.md`](../portfolio/evidence-index.md). PR13 release state and remaining manual gates are tracked in [`docs/portfolio/release-checklist.md`](../portfolio/release-checklist.md); those current navigation documents do not rewrite the point-in-time records below.

Treat their executed results as historical snapshots while using their evidence links as durable navigation.

## Historical execution records

These files explain how a past documentation, workflow, or repair change was executed. They remain truthful history, but their commands and intermediate lifecycle statements are not active guidance:

- [`ai-engineering-contract-v1.md`](ai-engineering-contract-v1.md)
- [`direct-agent-harness-v1.md`](direct-agent-harness-v1.md)
- [`f2-3-real-flow-specs.md`](f2-3-real-flow-specs.md)
- [`f3-1-plan-contract.md`](f3-1-plan-contract.md)
- [`f3-2-task-contract.md`](f3-2-task-contract.md)
- [`failure-recovery-scenarios.md`](failure-recovery-scenarios.md)
- [`interview-focused-ai-workflow.md`](interview-focused-ai-workflow.md)
- [`legacy-orchestrator-removal-v1.md`](legacy-orchestrator-removal-v1.md)
- [`main-ci-deploy-repair.md`](main-ci-deploy-repair.md)

Obsolete terminology and retired command paths are intentionally preserved inside these records when they accurately describe what ran at the time. Git history remains the source for deleted redundant or valueless records; none are currently classified for deletion from this directory.
