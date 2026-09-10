# Engineering Roadmap

This document records product and engineering direction: the capabilities already established, the evidence themes worth strengthening, and the current deployment direction. It is not an execution queue and does not authorize work.

Specifications own material behavior and acceptance, Plans own implementation decomposition, Tasks own bounded execution, and `docs/agents/harness.md` defines how eligible work is selected. Roadmap priority informs those artifacts but never substitutes for them.

## P0 — Correctness first

### P0.1 Reservation lifecycle

Implemented:

- `ACTIVE → RESERVED → SOLD`;
- `RESERVED → ACTIVE` after expiration (cannot overwrite `SOLD`);
- `reservedAt` and `reservationExpiresAt` persisted on reserve;
- expired reservations cannot be paid successfully;
- in-process expiry sweep for the modular monolith;
- tests cover concurrent purchase and expiration/payment races.

### P0.2 PayPal webhook reliability

Implemented:

- official PayPal RSA-SHA256 webhook verification (`PAYPAL_WEBHOOK_ID`, no production bypass);
- durable event identity in PostgreSQL (`PaymentWebhookEvent`, unique external event id);
- only `PAYMENT.CAPTURE.COMPLETED` confirms payment; `CHECKOUT.ORDER.APPROVED` is ignored as intermediate;
- concurrent duplicate events do not double-sell or double-pay;
- payment confirmation remains a single PostgreSQL transaction, including `reservedByOrderId`;
- in-process GET reconciliation for captured-but-unconfirmed orders;
- explicit PayPal HTTP timeout (`PAYPAL_API_TIMEOUT_MS`); `OrdersCreate` is not retried.

See `docs/adr/0002-paypal-webhook-reliability.md`.

### P0.3 Order idempotency

Implemented:

- client-provided idempotency key for order creation;
- durable idempotency state;
- concurrent identical requests have one business effect;
- retries return a deterministic result;
- crash scenarios do not create duplicate orders/reservations.

See `docs/adr/0003-order-creation-idempotency.md`.

## P1 — Production maturity

### P1.1 PostgreSQL integration tests

Implemented:

- real PostgreSQL harness with centralized `TRUNCATE ... CASCADE` lifecycle and factories;
- `test:unit` / `test:integration` / `test:all`;
- CI service container + `prisma migrate deploy`;
- integration tests fail closed when PostgreSQL is unavailable;
- transaction, unique-constraint and concurrency coverage for reservation, idempotency and payment persistence.

See `docs/testing.md`.

### P1.2 Observability

Implemented:

- existing Pino logs plus `X-Request-Id`, with `trace_id` / `span_id` when a span is active;
- optional OpenTelemetry SDK (`OTEL_ENABLED`, exporters `none` / `console` / `otlp`);
- HTTP, Prisma, PayPal and critical workflow spans;
- engineering and business counters with low-cardinality attributes;
- expected business results distinguished from operational errors;
- operator dashboards, SLOs, error budget, and request/trace diagnosis documented from those instruments (`SPEC-0008`, issues #62 / #63). No Grafana/Prometheus server.

See `docs/observability.md`, `docs/operations/dashboards.md`, `docs/operations/slos.md`, and `docs/adr/0004-opentelemetry.md`.

### P1.3 Resilience

Implemented:

- shared retry classification (timeout/network/429/5xx vs other 4xx) with max 3 attempts and exponential backoff;
- PayPal `OrdersCreate` / `OrdersCapture` still not retried;
- PayPal `OrdersGet`, OAuth token and webhook certificate download retry retryable failures;
- Resend verification email retries retryable failures; 4xx is not retried;
- SIGTERM/SIGINT drains HTTP (10s), stops in-process jobs, disconnects Prisma, shuts down telemetry;
- `GET /ready` returns 503 `shutting_down` during drain.

See `docs/adr/0005-external-retry-and-graceful-shutdown.md` and `docs/architecture/failure-modes.md`.

### P1.4 Performance evidence

Implemented:

- Repeatable `EXPLAIN ANALYZE` + workflow timings (`npm run perf:evidence`, CI in `performance.evidence.integration.test.ts`);
- Market page uses `Listing(status, createdAt, id)`; reconciliation uses `Order(paymentStatus, status, updatedAt)`;
- `COUNT(*)` identified as the listing-list cost, not a reason to add Redis;
- Capacity assumptions and scaling triggers documented.

See `docs/performance.md`, `docs/architecture/scaling-path.md` and `docs/adr/0006-hot-path-indexes.md`.

### P1.5 Transactional outbox

Implemented:

- `OutboxEvent` committed in the same PostgreSQL transaction as payment confirmation (`PAYMENT_CONFIRMED` / `ORDER_CONFIRMED`);
- in-process dispatcher (`setInterval` + `unref` + `FOR UPDATE SKIP LOCKED`);
- bounded retries, backoff, stale-claim recovery, unique `(type, aggregateId)`;
- first handler is structured log + metrics (no second `confirmPayment`);
- not SQS / Kafka / Redis.

See `docs/adr/0012-transactional-outbox.md`.

## P2 — Cloud and operational maturity

**Current production** (see `docs/adr/0007-cloud-target-render.md`):

```text
Internet
   ↓
Vite SPA (Vercel)
   ↓
Render web service neon-arsenal-api (Docker)
   ↓
Render PostgreSQL neon-arsenal-db
   + PayPal / Resend
```

The ECS/Fargate sketch below is a **future option**, not a committed migration. Do not provision it. C2 must skip Terraform while ADR 0007 stands.

```text
Internet → Load Balancer → ECS/Fargate API → RDS → Secrets Manager → CloudWatch
```

The historical C2 decision was recorded as a skip after ADR 0007 retained Render. Canonical topology: `docs/architecture/c4.md`. Operations: `docs/operations/runbook.md`.

## Documentation deliverables

Maintain:

- `docs/architecture/current-state.md`
- `docs/domain/invariants.md`
- `docs/architecture/domain-invariants.md`
- `docs/architecture/c4.md`
- `docs/architecture/sequences.md`
- `docs/architecture/scaling-path.md`
- `docs/architecture/capacity.md`
- `docs/architecture/failure-modes.md`
- `docs/architecture/threat-model.md`
- `docs/adr/`
- `docs/operations/runbook.md`
- `docs/operations/dashboards.md`
- `docs/operations/slos.md`
- `docs/agents/`

Documentation is part of the implementation whenever a design or operational decision changes.

## From direction to execution

Roadmap themes become executable only through the repository authority model. Material behavior requires an accepted Specification; implementation strategy and ordering belong in a Plan; bounded work and dependencies belong in Tasks. `AGENTS.md` supplies global guardrails and `docs/agents/harness.md` supplies the execution procedure.

Historical sprint catalogs and their completed ordering remain recoverable in Git history. They are not maintained as current roadmap or task state.
