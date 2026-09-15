# Neon Arsenal Market — Backend Engineering Case Study

## Problem

Neon Arsenal Market is a marketplace for individually owned Counter-Strike 2 skin listings. The backend problem is not ordinary catalog CRUD: one unique item cannot be sold twice, money cannot be derived from client claims, provider success can occur before local success, retries must not create a second economic effect, and operators need a recoverable path when any of those workflows fail halfway through.

The current system is intentionally a modular monolith. PostgreSQL is the source of truth for business state; Express owns the application boundary; PayPal and Resend are external trust boundaries. The project optimizes for explicit correctness and evidence before architectural breadth.

## Constraints

- Listings are unique inventory, so reservation and sale are concurrency-sensitive.
- Checkout is BRL and monetary state must remain transactionally consistent.
- PayPal is an external system whose network response and economic outcome are not the same thing.
- Webhooks can be duplicated, delayed, reordered, or retried.
- A remote refund can succeed while the corresponding local transaction fails.
- Background recovery runs inside the API process today; the project does not claim distributed-worker durability.
- Portfolio claims must be supported by executable tests, tracked evidence, or explicit operational documentation.

## Key decisions

### Keep PostgreSQL authoritative

Critical state transitions use transactions, conditional updates, uniqueness constraints, and explicit invariants rather than relying on read-then-write application logic. See [current architecture](../architecture/current-state.md), [domain invariants](../domain/invariants.md), and the [ADR index](../adr/README.md).

### Keep provider I/O outside critical database transactions

PayPal calls are separated from local commit boundaries. Trusted provider state is reconciled into PostgreSQL rather than holding a database transaction open across remote I/O. See [PayPal webhook reliability](../adr/0002-paypal-webhook-reliability.md) and [provider boundary](../adr/0025-paypal-provider-boundary.md).

### Prefer idempotent and recoverable workflows

Order creation uses a customer-scoped idempotency key. Payment/webhook/refund flows persist durable identities and use conditional claims so retries converge instead of duplicating business effects. Payment confirmation also records outbox events in the same local transaction. See [order idempotency](../adr/0003-order-creation-idempotency.md), [transactional outbox](../adr/0012-transactional-outbox.md), and [refund compensation](../adr/0024-refund-compensation.md).

### Do not add distributed infrastructure without measured need

The project deliberately does not use Kafka, Kubernetes, Redis, microservices, CQRS, event sourcing, or a service mesh. The final Senior Backend audit classified that expansion as portfolio theater without evidence of a problem it would solve. See [PR11 final audit](../verification/final-senior-backend-audit-2026-09-14.md).

## Hardest problems solved

### 1. Exclusive reservation under concurrency

Order creation atomically claims an `ACTIVE` listing as `RESERVED`, persists the owning order and expiration, and prevents two concurrent buyers from both succeeding. Payment may sell the listing only while that same order owns an unexpired reservation. The SOLD state is guarded against cancellation races.

Evidence: [listing invariants](../domain/invariants.md), [current architecture](../architecture/current-state.md), and the PostgreSQL reservation/payment race tests referenced by the [PR11 audit](../verification/final-senior-backend-audit-2026-09-14.md).

### 2. Idempotent payment confirmation and trusted webhooks

The browser cannot declare an order paid. PayPal webhook authenticity is verified before processing, `APPROVED` remains intermediate, and only trusted `COMPLETED` state is accepted for local confirmation. Duplicate provider events are keyed durably and cannot create duplicate economic effects.

Evidence: [ADR 0002](../adr/0002-paypal-webhook-reliability.md), [threat model](../architecture/threat-model.md), and the integration suites referenced by the [PR11 audit](../verification/final-senior-backend-audit-2026-09-14.md).

### 3. Remote-success / local-failure refund recovery

If a trusted PayPal capture succeeds but fulfillment can no longer be completed, the service creates one durable technical-refund obligation. A stable provider request identity allows reconciliation after timeout or process failure. Local refund completion and seller compensation are applied only after provider completion is trusted, preserving an append-only financial trail.

Evidence: [SPEC-0013](../specs/SPEC-0013-refund-financial-compensation.md), [ADR 0024](../adr/0024-refund-compensation.md), [failure scenarios](../verification/failure-recovery-scenarios.md), and the PR12 game-day/runbook material under [`docs/operations`](../operations/).

### 4. Transactional outbox without pretending it is Kafka

Payment confirmation writes business state and outbox rows in one PostgreSQL transaction. An in-process dispatcher claims rows with PostgreSQL locking, retries bounded failures, and reclaims stale work. Delivery semantics are documented honestly; the repository does not claim exactly-once delivery.

Evidence: [ADR 0012](../adr/0012-transactional-outbox.md), [current architecture](../architecture/current-state.md), and operational recovery material under [`docs/operations`](../operations/).

### 5. Contract and security credibility

PR11 found and corrected authorization/data-exposure gaps, a commission-policy bypass, an unaudited price-update path, and an OpenAPI inventory gap. The important point is not that no defects ever existed; it is that the repository contains an adversarial audit, bounded remediation, regression tests, and explicit remaining limitations.

Evidence: [Final Senior Backend Audit](../verification/final-senior-backend-audit-2026-09-14.md) and [security documentation](../security/).

## Failure scenarios

The system is designed around convergence rather than assuming the happy path:

- two buyers race for one listing → one conditional reservation wins;
- cancellation races payment → mutually guarded transitions prevent SOLD from being overwritten;
- duplicate order submission → the same customer/key/request replays the original result;
- duplicate webhook → durable provider-event identity prevents a second economic effect;
- capture succeeds but local fulfillment cannot commit → technical refund obligation is persisted and reconciled;
- process exits with unpublished outbox work → stale claims can be reclaimed;
- readiness is lost or shutdown begins → `/ready` rejects traffic while `/health` remains a liveness signal.

See [failure modes](../architecture/failure-modes.md) and [failure-recovery scenarios](../verification/failure-recovery-scenarios.md).

## Operational model

Production topology is Vercel frontend → Render API → PostgreSQL, with PayPal and Resend as external integrations. Health/readiness semantics, deployment, rollback, SLI/SLO definitions, dashboards/instrument mapping, failure modes, game days, and recovery procedures are documented in [`docs/operations`](../operations/).

PR12 is the production/operational proof phase. It establishes operational evidence without overstating provider capabilities that were not directly proven.

## Performance

The repository contains controlled k6 evidence rather than a production-scale claim. The tracked catalog profile held a configured 150 RPS for 60 seconds in three equivalent controlled repetitions with zero HTTP failures and zero dropped iterations. Repeated 200 RPS runs became unstable while API CPU approached its configured limit, identifying an API-CPU boundary in that environment.

This is not evidence that Render production capacity is 150 RPS. See the [performance evidence](../performance/) and [capacity model](../architecture/capacity.md).

## Security

Trust boundaries are explicit: browser input is untrusted, authentication/ownership/role checks stay server-side, PayPal webhook signatures and transmission time are verified, secrets remain deployment configuration, and CI includes dependency/container security gates. See the [threat model](../architecture/threat-model.md) and [`docs/security`](../security/).

## Engineering process

Implementation was AI-assisted under repository-defined authority and human gates:

`Intent → Specification → Plan → Task → Implementation → Evidence`

Specifications, ADRs, invariants, source code, tests, CI, runbooks, and tracked evidence are authoritative for their respective concerns. Agents can implement bounded work, but material ambiguity involving money, security, public contracts, database state, architecture boundaries, or business behavior requires human resolution. Merge remains a human gate.

This is intentionally different from treating an agent as autonomous engineering authority. See [`AGENTS.md`](../../AGENTS.md) and the [agent harness](../agents/harness.md).

## Trade-offs and known limits

The final audit leaves several valid P1 improvements frozen rather than disguising them as complete: confirmed-order cancellation/refund policy (AUD-002), payment-link recovery after remote create/local persistence failure (AUD-020), deeper capture reconciliation after expiry cancellation (AUD-021), historical agent-document residue (AUD-030), standalone-reserve inventory griefing (AUD-032), and transactional composition of account/seller onboarding (AUD-033).

Production OTLP export/receiver evidence and the live managed-backup posture remain explicitly NOT PROVEN where provider/account access did not establish them. Horizontal multi-instance behavior, multi-region operation, HA/failover, and production-scale throughput are not claimed.

AUD-034 rejected speculative Kafka/Kubernetes/microservice/CQRS/event-sourcing/Redis/service-mesh expansion because there is no measured requirement for it.

## Final result

The project demonstrates backend engineering through evidence: concurrency-safe unique inventory, explicit transaction boundaries, idempotent money workflows, provider partial-failure recovery, append-only financial compensation, contract/security testing, measurable performance, and documented operations. It also records where the evidence stops.

For a time-boxed review, continue with the [reviewer guide](reviewer-guide.md) and [evidence index](evidence-index.md).