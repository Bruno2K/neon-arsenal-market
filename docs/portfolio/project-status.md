# Project status — portfolio complete / maintenance

## Status

**Current:** PR13 portfolio release candidate, awaiting human review and merge.

**After PR13 merge:** **PORTFOLIO COMPLETE / MAINTENANCE**.

PR10 closed portfolio convergence. PR11 merged the final adversarial Senior Backend audit and seven P0 corrections. PR12 merged production/operational proof with explicit provider-level evidence boundaries. PR13 packages the final reviewer path and freeze policy. No PR14 is planned.

## What maintenance allows

- security fixes;
- dependency maintenance;
- broken deployment fixes;
- regression fixes;
- documentation corrections;
- explicitly justified future product iteration.

## What is not allowed by default

- architecture expansion without a measured constraint;
- speculative infrastructure;
- “one more roadmap” or hardening wave;
- implementation whose main purpose is increasing technology count;
- silently reopening frozen behavior or changing payment, refund, money, concurrency, or security semantics.

Any proposed major phase must answer:

1. What measured problem exists?
2. Why does the current architecture fail to solve it?
3. What evidence justifies reopening development?
4. Why is this a better investment than starting a new portfolio project?

A material change still requires the repository's Specification → Plan → Task → Implementation → Evidence authority chain and a human merge decision.

## Frozen backlog

These PR11 P1 findings are valid future improvements, but none is required for the current portfolio evidence and PR13 does not implement them:

| Finding | Frozen improvement | Why it remains frozen |
|---|---|---|
| AUD-002 | Define product and financial policy for customer cancellation of a `CONFIRMED` order, including refund semantics | Requires a human product/money decision; current behavior is explicit and not a hidden consistency defect |
| AUD-020 | Recover a `PaymentLink.IN_PROGRESS` claim after remote PayPal create succeeds but local persistence fails | Availability/cleanup improvement; no captured funds or duplicate local economic effect is implied |
| AUD-021 | Extend PayPal capture reconciliation beyond stale `PENDING` orders after expiry cancellation | Legitimate recovery-depth improvement; current limit is disclosed and must not be changed casually |
| AUD-030 | Retire stale command references inside accepted historical agent evidence | Historical artifacts are intentionally point-in-time records; rewriting them would falsify what ran |
| AUD-032 | Prevent authenticated standalone-reserve inventory griefing | Valid abuse hardening; current hold is TTL-bounded and the change needs an explicit product/API decision |
| AUD-033 | Compose email verification and seller application related writes in single transactions | Reliability improvement for partial DB failure; no auth bypass or money movement is currently shown |

AUD-034 is a rejected P2 proposal, not backlog promised for delivery: Kafka, Kubernetes, microservices, CQRS/event sourcing, Redis without scale evidence, service mesh, or an AWS rewrite would add architecture theater rather than solve a measured problem. Reconsidering any of them requires a new human-approved ADR with evidence that supersedes the current decision.

## Known evidence limits

- Production OTLP delivery, receiver history, retention, dashboards, alert routing, and pager operation are **NOT PROVEN**.
- `render.yaml` declares Free PostgreSQL; the exact live Render plan, managed backup state, and a timed restore are **NOT PROVEN**. No external backup automation is claimed.
- Exact Render deployed SHA and authenticated provider workspace/security controls are **NOT PROVEN** by public probes.
- Sustained production SLO attainment, production traffic/capacity, horizontal multi-instance operation, multi-region availability, and HA/failover are not claimed.
- In-process background jobs and rate-limit counters impose documented coordination limits.

These boundaries describe where evidence stops; they are not invitations to add infrastructure without a requirement.

## Manual repository administration

**MANUAL FOLLOW-UP:** Enable a `main` branch ruleset/protection after GitHub account authentication is available. Protection is not currently claimed as active, and PR13 does not block on this provider/account task.

## Release gate

The final status checklist is [release-checklist.md](release-checklist.md). PR13 must remain unmerged until a human reviews it. After merge, maintenance changes should be rare, scoped, and evidence-driven.
