# Engineering Roadmap

This is the execution queue for the AI agent team. Work from top to bottom unless the human explicitly changes priority.

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
- expected business results distinguished from operational errors.

See `docs/observability.md` and `docs/adr/0004-opentelemetry.md`.

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
- Market page uses `Listing(status, createdAt)`; reconciliation uses `Order(paymentStatus, status, updatedAt)`;
- `COUNT(*)` identified as the listing-list cost, not a reason to add Redis;
- Capacity assumptions and scaling triggers documented.

See `docs/performance.md`, `docs/architecture/scaling-path.md` and `docs/adr/0006-hot-path-indexes.md`.

## P2 — Cloud and operational maturity

**Current production** (see `docs/adr/0007-cloud-target-render.md`):

```text
Internet
   ↓
Vite SPA (Vercel, or Render static neon-arsenal-web)
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

Remaining P-back work after this ADR: **C2 skip commit** (no AWS). Catalog: `docs/backend-sprint.md`. Live topology: `docs/architecture/c4.md`. Operations: `docs/operations/runbook.md`.

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

## P-back — Backend sprint (control plane)

Post-P1 remaining work is **not** AWS next. Catalog and agent loop: `docs/backend-sprint.md`, `docs/agents/p-back-orchestrator.md`. Next activity: `python3 scripts/p-back/next.py`.

## P-front — Frontend rebuild (parallel, `src/` only)

Rebuild the existing Vite/React client. No new product features. Locked decisions and activity graph: `docs/frontend-sprint.md`. Agent loop: `docs/agents/p-front-orchestrator.md`. Next activity: `python3 scripts/p-front/next.py`.

May run beside P-back only while PRs stay disjoint (`src/` vs `server/`).

## Agent execution rule

Only one roadmap item should normally be in active implementation at a time. Split a roadmap item into small tasks when it is too large for one reviewable change.

A lower-priority item must not distract the team from a known unresolved correctness problem.

P-front / P-back are an explicit exception for **file-disjoint** parallelism: frontend agents own `src/` and `docs/frontend-sprint.md`; backend agents own `server/` and `docs/backend-sprint.md`.
