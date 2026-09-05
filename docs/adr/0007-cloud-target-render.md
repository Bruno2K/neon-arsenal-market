# ADR 0007 — Cloud production target (Render vs ECS)

## Status

Accepted

## Context

The modular monolith already runs in production-shaped config as **Render** (`render.yaml`): Docker API `neon-arsenal-api`, managed PostgreSQL `neon-arsenal-db`, env-based secrets, `healthCheckPath: /ready`. Operations are in `docs/operations/runbook.md`. C4 of the live system is `docs/architecture/c4.md`.

`AGENTS.md` and the P2 roadmap still show a **portfolio sketch**:

```text
Internet → Load Balancer → ECS/Fargate API → RDS → Secrets Manager → CloudWatch
```

That sketch was never provisioned. There is no Terraform, no AWS account layout in this repo, and no measured scaling trigger that the monolith-on-Render cannot absorb (`docs/architecture/scaling-path.md`).

P-back activity **C1** must say, in one ADR, whether that sketch is a **committed migration** or a **future option**. Implementing AWS (C2) is forbidden unless this ADR selects AWS. `docs/agents/decision-policy.md` forbids an agent from silently changing the cloud/architecture boundary to ECS.

A committed ECS migration would be a material cloud-architecture change (new runtime, networking, secrets, observability). That is a **human** decision. This ADR does **not** make it.

## Decision

1. **Current production target is Render.** The API, database, probes, drain, and secrets model in `render.yaml` / the runbook are the system to operate and interview against.
2. **The ECS/Fargate diagram is a future option, not a committed migration.** Keep it as a sentence in the roadmap so the portfolio can discuss an AWS path. Do not treat ALB, ECS, RDS, or Secrets Manager as live. Do not write Terraform in C2.
3. **Frontend hosting is orthogonal.** The documented split is Vercel (Vite) + Render (API). The Blueprint also defines Render static `neon-arsenal-web`. Neither is ECS.
4. **PostgreSQL remains the source of truth** wherever the process runs. Moving compute to Fargate would not change reservation, payment, or webhook invariants.
5. **Revisit only with a human supersession** of this ADR, plus a concrete reason such as: a measured scaling trigger that Render cannot meet, a compliance requirement for a specific AWS control, or an explicit owner request to migrate. Until then, agents must not “start AWS to look senior.”

Rejected alternatives:

- Silently selecting ECS/Fargate as the production target and implementing Terraform in the next PR.
- Deleting the ECS sketch so interviews cannot discuss a future AWS option.
- Dual “we are on Render and also on ECS” language that makes C4 and the runbook lie.

## Consequences

- **C2 (AWS/Terraform) is a skip:** see `docs/adr/0008-c2-skip-terraform.md`. Do not invent VPC/Secrets Manager layouts.
- Interview drawings should start from `docs/architecture/c4.md` (Render + Postgres + PayPal/Resend). The P2 ECS boxes are labeled **optional future**, not current.
- Cost, TLS, deploys, and logs stay on Render (and Vercel for the common SPA). Optional OpenTelemetry (`OTEL_ENABLED`) is not CloudWatch.
- A later owner who wants AWS should change this ADR’s status to **Superseded** with a new ADR that scopes the migration; only then may C2-style Terraform exist.

## What this ADR does not change

- `render.yaml` (already the production Blueprint).
- Application behavior, PayPal contracts, or domain invariants.
- The open R2 human decision on capture-after-expiry refund/void (dashboard vs a real PayPal API).
