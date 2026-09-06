# Operational dashboards

These panels describe how to read telemetry the API already emits. They are **not** a Grafana, Prometheus, or hosted metrics product. Production compute is Render (ADR 0007). Export is optional (`OTEL_ENABLED`, ADR 0004).

Importable definition: [`dashboards/neon-arsenal-api.json`](./dashboards/neon-arsenal-api.json). An operator can map those instrument names into whatever OTLP-backed UI they already run. This repository does not start a collector.

Contract: `SPEC-0008`. SLOs that use these panels: [`slos.md`](./slos.md). Instrument source: `server/src/shared/observability/`.

## How to use this file

1. Enable `OTEL_ENABLED=true` and an exporter (`console` locally, `otlp` if you already have an endpoint).
2. Filter series by the attributes listed here. Do not add user, order, listing, or email labels.
3. `http.route` is the Express pattern plus mount prefix. Count **both** unversioned and `/api/v1` series (SPEC-0007).
4. `/health` and `/ready` never appear in HTTP metrics or `http.server.request` spans.

When OTEL is off, skip panels and use Render logs + the SQL in [`runbook.md`](./runbook.md).

## Allowed metric attributes

| Instrument family | Attributes | Cardinality note |
|---|---|---|
| HTTP | `http.request.method`, `http.route`, `http.response.status_code` | Route is a pattern (`/listings/:id`), never the raw URL |
| Database | `db.system=postgresql`, `db.operation`, `db.collection` | Prisma model name, not SQL |
| PayPal HTTP | `paypal.operation` (`orders_create`, `orders_get`, `orders_capture`, `oauth_token`); optional `http.response.status_code` on some points | Four operations only |
| Business counters | *(none)* | Totals only |

`safeAttributes()` drops secrets and bearer/JWT-looking values. Do not re-introduce them on a panel.

## Critical traces

Parent is usually `http.server.request` with `request.id` = `X-Request-Id`.

| Span | When | Success `app.outcome` | Investigate |
|---|---|---|---|
| `http.server.request` | Every request except probes | status &lt; 500 | 5xx → `http.server.errors` |
| `orders.create` | `POST /orders` | `created`, `idempotency_replay` | `idempotency_conflict`, `reservation_conflict`, `error` |
| `orders.create.transaction` | Same, inside the PG transaction | (child) | Duration vs `db.prisma` |
| `listings.reserve` | Order path or `POST /listings/:id/reserve` | `created` | `reservation_conflict` |
| `listings.expire` | 30 s sweep | — | Sweep errors in logs |
| `payments.create_link` | `POST /payments/create` | `created`, `idempotency_replay` | `paypal.orders_create` timeout |
| `payments.capture` | `POST /payments/capture` | `confirmed`, `already_confirmed` | `paypal.orders_capture` + `payments.confirm` |
| `payments.confirm` | Trusted confirm only | `confirmed`, `already_confirmed` | `reservation_expired`, `error` |
| `payments.confirm.transaction` | Claim order, sell listings, ledger | (child) | Must stay in PostgreSQL |
| `paypal.webhook.verify` | `POST /payments/webhook` | `confirmed` | `webhook_failed` (bad signature / missing id) |
| `paypal.webhook.handle` | After verify | `confirmed`, `webhook_duplicate`, `webhook_ignored` | `reservation_expired`, `webhook_failed` |
| `payments.reconcile` | 60 s GET sweep | attributes `app.reconcile_scanned`, `app.reconcile_confirmed` | PayPal GET errors; no lag metric |
| `seller.ledger.reconcile` | 60 s projection check | `app.reconcile_corrected` | `seller.ledger.drift_detected` |
| `outbox.dispatch` | In-process dispatcher | — | `outbox.failed` |
| `paypal.{operation}` | Client HTTP | `confirmed` | `timeout`, `provider_error` |
| `db.prisma` | Prisma query | — | `db.client.errors`; no SQL text |

`app.outcome` values `timeout`, `provider_error`, and `error` set span status ERROR. Expected 4xx business outcomes stay UNSET.

## Dashboard 1 — API

**Purpose:** Is the process answering, and how slow are user routes?

| Panel | Instrument | How to read |
|---|---|---|
| Request rate | `http.server.request.count` | Rate by `http.request.method` + `http.route` |
| Latency | `http.server.request.duration` (unit `s`) | p50 / p95 / p99. Catalog and checkout SLOs use this histogram |
| 5xx | `http.server.errors` | Availability SLI numerator |
| 5xx ratio | `http.server.errors / http.server.request.count` | See SLO-AVAIL-01 |
| Status mix | `http.server.request.count` by `http.response.status_code` | 401/404/409 are usually business, not outages |

**Catalog routes** (both prefixes): `GET /listings`, `GET /listings/:id`, `GET /products`, `GET /products/:id`, and the same paths under `/api/v1`.

**Checkout routes** (both prefixes): `POST /orders`, `POST /payments/create`, `POST /payments/capture`, `POST /payments/webhook`.

Render `GET /ready` is the instance probe. It is **not** on this dashboard.

## Dashboard 2 — Orders and reservations

**Purpose:** Did exclusive reserve work, and are buyers colliding?

| Panel | Instrument | How to read |
|---|---|---|
| Orders created | `orders.created` | Successful new orders |
| Creation failed | `orders.creation_failed` | Validation / unexpected create failures |
| Idempotent replay | `orders.idempotency_replay` | Expected retry; not an error |
| Idempotency conflict | `orders.idempotency_conflict` | Same key, different body or in-progress |
| Reservations created | `reservations.created` | `ACTIVE → RESERVED` wins |
| Reservation conflicts | `reservations.conflict` | Other buyer or not ACTIVE |
| Reservations expired | `reservations.expired` | Sweep released the hold |
| Order create trace | span `orders.create` | `app.outcome` + child `orders.create.transaction` / `listings.reserve` |

There is **no** `orders.pending` gauge. Count unpaid work in PostgreSQL:

```sql
SELECT COUNT(*) FROM "Order" WHERE "paymentStatus" = 'PENDING' AND status = 'PENDING';
```

## Dashboard 3 — Payments

**Purpose:** PayPal HTTP and local confirm, without treating expiry as an outage.

| Panel | Instrument | How to read |
|---|---|---|
| PayPal calls | `paypal.client.request.count` by `paypal.operation` | `orders_create`, `orders_get`, `orders_capture`, `oauth_token` |
| PayPal latency | `paypal.client.request.duration` (unit `s`) | Dominates `POST /payments/create` and capture |
| PayPal errors | `paypal.client.errors` | Provider/HTTP failures |
| PayPal timeouts | `paypal.client.timeouts` | 504 / `PAYPAL_API_TIMEOUT_MS` (default 10 s) |
| Confirmed | `payments.confirmed` | Local `PAID` after trusted COMPLETED |
| Confirm failed | `payments.failed` | Mixed: includes `reservation_expired` 409. Filter traces by `app.outcome` |
| Create-link / capture traces | `payments.create_link`, `payments.capture` | Child `paypal.*` then `payments.confirm` |

Buyer time from “Pay with PayPal” to `PAID` is **not** a metric. Proxies: PayPal client duration + local `payments.confirm` span duration when traces are exported.

## Dashboard 4 — Webhooks

**Purpose:** Delivery, duplicates, ignores, and real handle failures.

| Panel | Instrument | How to read |
|---|---|---|
| Received | `paypal.webhooks.received` | Every parsed or unparsed delivery attempt that reached the handler |
| Duplicate | `paypal.webhooks.duplicate` | Unique `(provider, externalEventId)` claim; expected |
| Ignored | `paypal.webhooks.ignored` | `CHECKOUT.ORDER.APPROVED` and unknown types |
| Failed | `paypal.webhooks.failed` | Mixed: bad payload, verify fail, 503 order-not-ready, **and** `reservation_expired` |
| Verify / handle traces | `paypal.webhook.verify`, `paypal.webhook.handle` | `paypal.event_type`; `app.outcome` |

HTTP 200 after `reservation_expired` is intentional so PayPal stops retrying. Confirm money in the PayPal dashboard; do not sell the listing. See runbook **Capture after reservation expiry**.

## Dashboard 5 — Reconciliation and ledger

**Purpose:** In-process recovery jobs, not a queue lag gauge.

| Panel | Instrument | How to read |
|---|---|---|
| Reconcile batch | span `payments.reconcile` | Duration = batch work, **not** how late a capture is |
| Scanned / confirmed | span attributes `app.reconcile_scanned`, `app.reconcile_confirmed` | Requires traces |
| PayPal GET | `paypal.client.request.duration` where `paypal.operation=orders_get` | Sweep lookup cost |
| Ledger drift | `seller.ledger.drift_detected` | Projection disagreed with PAID SUM |
| Ledger corrected | `seller.ledger.corrected` | Projection written back to SUM |
| Ledger span | `seller.ledger.reconcile` | `app.reconcile_scanned`, `app.reconcile_drift_candidates`, `app.reconcile_corrected` |
| Outbox | `outbox.published`, `outbox.retry`, `outbox.failed` | First handler is log+metric only |

**Reconciliation lag is not instrumented.** Config floor: ignore orders younger than 2 minutes (`PAYPAL_RECONCILE_MIN_AGE_MS`), then wait up to 60 s for the next sweep (`PAYPAL_RECONCILE_INTERVAL_MS`), batch 20. A sleeping free Render instance cannot sweep until the next request wakes it.

Pending-but-old orders: SQL in [`runbook.md`](./runbook.md) (Inspect payments and reservations).

## Dashboard 6 — Database

**Purpose:** Prisma/PostgreSQL operation time and errors. No SQL text.

| Panel | Instrument | How to read |
|---|---|---|
| Operation duration | `db.client.operation.duration` (unit `s`) | p95 by `db.operation` + `db.collection` |
| Errors | `db.client.errors` | Unexpected Prisma failures |
| Traces | `db.prisma` | Same attributes; never bind parameters |

Checkout lock waits show up as longer `db.prisma` / `orders.create.transaction` spans, not as a lock gauge.

## Alert thresholds (runbook, not a pager)

See [`runbook.md`](./runbook.md#alert-thresholds-no-pager). Thresholds are investigation triggers for a human reading Render logs or an optional OTLP UI.
