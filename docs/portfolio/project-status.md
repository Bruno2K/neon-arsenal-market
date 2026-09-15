# Project status — portfolio complete / maintenance mode

## Status

**Status: PORTFOLIO COMPLETE / MAINTENANCE MODE.**

- PR10: complete / merged.
- PR11: complete / merged.
- PR12: complete / merged.
- PR13: complete / merged.
- Functional roadmap: closed.
- Unresolved P0: 0.
- Functional development: frozen.

PR10 closed portfolio convergence. PR11 merged the final adversarial Senior Backend audit and seven P0 corrections. PR12 merged production/operational proof with explicit provider-level evidence boundaries. PR13 merged the final reviewer path and freeze policy. The repository is now maintained as a portfolio project.

## What maintenance allows

- security fixes;
- dependency maintenance;
- broken deployment fixes;
- regression fixes;
- documentation corrections;
- explicitly justified future product work.

## What is not allowed by default

- PR14 or a new functional roadmap;
- speculative architecture expansion or infrastructure added for portfolio points;
- Kafka, Kubernetes, microservices, CQRS, event sourcing, a service mesh, or Redis without measured need;
- another generic hardening roadmap;
- implementation whose main purpose is increasing technology count;
- silently reopening frozen behavior or changing payment, refund, money, concurrency, or security semantics.

Any proposed major phase must answer:

1. What measured problem exists?
2. Why does the current architecture fail to solve it?
3. What evidence justifies reopening development?
4. Why is this a better investment than starting a new portfolio project?

A material change still requires the repository's Specification → Plan → Task → Implementation → Evidence authority chain and a human merge decision.

## Frozen backlog

These PR11 P1 findings remain valid known limitations, but they are frozen rather than unfinished roadmap obligations:

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

- Enable a GitHub `main` ruleset / branch protection when account authentication is available. Branch protection is not currently active.
- Configure the repository description and topics.
- Decide and document the repository license.
- Triage open Dependabot PRs without automatically merging them.

These are repository-maintenance follow-ups, not development blockers or a new engineering roadmap.

## Release gate

The historical PR13 release checklist is [release-checklist.md](release-checklist.md). PR13 has merged; maintenance changes should be rare, scoped, evidence-driven, and subject to human review.
