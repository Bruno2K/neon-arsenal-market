# Engineering Roadmap

This is the execution queue for the AI agent team. Work from top to bottom unless the human explicitly changes priority.

## P0 — Correctness first

### P0.1 Reservation lifecycle

Implement and prove:

- `ACTIVE → RESERVED → SOLD`;
- `RESERVED → ACTIVE` after expiration;
- `reservedAt` and `reservationExpiresAt` are persisted correctly;
- expired reservations cannot be paid successfully;
- expiration and payment confirmation are race-safe;
- a periodic cleanup mechanism exists;
- tests cover concurrent purchase and expiration/payment races.

### P0.2 PayPal webhook reliability

Implement and prove:

- webhook authenticity/signature validation;
- explicit accepted event types;
- duplicate event handling;
- out-of-order event handling;
- durable event/idempotency identity where appropriate;
- local failure and crash recovery;
- reconciliation strategy.

### P0.3 Order idempotency

Implement and prove:

- client-provided idempotency key for order creation;
- durable idempotency state;
- concurrent identical requests have one business effect;
- retries return a deterministic result;
- crash scenarios do not create duplicate orders/reservations.

## P1 — Production maturity

### P1.1 PostgreSQL integration tests

Add a reproducible real-PostgreSQL test environment covering transactions, constraints, concurrency and rollback.

### P1.2 Observability

Add:

- structured logs;
- request/correlation IDs;
- OpenTelemetry traces;
- order/payment/webhook/reservation metrics;
- database and external-provider latency/error metrics.

### P1.3 Resilience

Add explicit:

- external request timeouts;
- bounded retries with backoff;
- retry classification;
- graceful shutdown;
- reconciliation jobs where needed.

Use circuit breakers only when a concrete failure mode justifies them.

### P1.4 Performance evidence

Produce:

- benchmark for important endpoints/workflows;
- `EXPLAIN ANALYZE` evidence for important queries;
- index review;
- hot-path and capacity notes;
- identified bottleneck and chosen mitigation.

## P2 — Cloud and operational maturity

Target architecture:

```text
Internet
   ↓
Load Balancer
   ↓
ECS/Fargate API
   ↓
RDS PostgreSQL
   ↓
Secrets Manager
   ↓
CloudWatch + OpenTelemetry
```

Implement progressively:

- production Docker image;
- CI/CD;
- AWS deployment;
- RDS;
- Secrets Manager;
- health/readiness checks;
- centralized logs;
- Terraform;
- migration strategy;
- rollback/runbook.

## Documentation deliverables

Maintain:

- `docs/architecture/current-state.md`
- `docs/architecture/domain-invariants.md`
- `docs/architecture/c4.md`
- `docs/architecture/scaling-path.md`
- `docs/architecture/failure-modes.md`
- `docs/architecture/threat-model.md`
- `docs/adr/`
- `docs/operations/runbook.md`
- `docs/agents/`

Documentation is part of the implementation whenever a design or operational decision changes.

## Agent execution rule

Only one roadmap item should normally be in active implementation at a time. Split a roadmap item into small tasks when it is too large for one reviewable change.

A lower-priority item must not distract the team from a known unresolved correctness problem.
