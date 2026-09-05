# Observability

Neon Arsenal Market uses OpenTelemetry for traces and metrics, and Pino for logs. The goal is to diagnose latency, errors and business failures on the checkout path without running an observability platform locally.

## Defaults

Telemetry is **off** unless `OTEL_ENABLED=true`.

| Variable | Default | Purpose |
|---|---|---|
| `OTEL_ENABLED` | unset/false | Start the SDK |
| `OTEL_EXPORTER` | `none` | `none`, `console`, or `otlp` |
| `OTEL_SERVICE_NAME` | `neon-arsenal-api` | Resource service name |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | Base OTLP HTTP endpoint |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | unset | Overrides the traces URL |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | unset | Overrides the metrics URL |

`npm run dev` does not need Docker extras, Jaeger, Grafana, Prometheus or a collector. If the chosen exporter is unreachable, request handling continues.

## Correlation

Every request still gets `X-Request-Id` from `requestId` middleware. The same value is stored in `AsyncLocalStorage` and written on the HTTP span as `request.id`.

When a span is active, Pino adds `trace_id` and `span_id`. Correlate:

```text
X-Request-Id → request.id on http.server.request → child spans → logs
```

Inbound W3C `traceparent` / `tracestate` are accepted. Do not introduce a second correlation-ID scheme.

## Spans

| Span | Meaning |
|---|---|
| `http.server.request` | Inbound HTTP, except `/health` and `/ready` |
| `orders.create` | Order creation, including idempotency outcomes |
| `orders.create.transaction` | PostgreSQL transaction that reserves listings and writes the order |
| `listings.reserve` | Reservation attempt (order path or standalone reserve) |
| `listings.expire` | Expired-reservation sweep |
| `payments.confirm` | Payment confirmation |
| `payments.confirm.transaction` | Claim order, sell listings, write seller transactions |
| `payments.reconcile` | PayPal GET reconciliation batch |
| `paypal.webhook.verify` | Webhook signature verification |
| `paypal.webhook.handle` | Event claim, ignore, confirm or fail |
| `paypal.orders_create` / `orders_get` / `orders_capture` / `oauth_token` | PayPal HTTP |
| `db.prisma` | Prisma operation (`db.operation` + `db.collection` only) |

`app.outcome` distinguishes expected business results from operational failures:

| Outcome | Typical cause | Span status |
|---|---|---|
| `created` / `confirmed` | Success | UNSET |
| `idempotency_replay` | Same key and listing set | UNSET |
| `idempotency_conflict` | Same key, different request or in-progress | UNSET |
| `reservation_conflict` | Listing already held | UNSET |
| `reservation_expired` | Payment after expiry | UNSET |
| `webhook_duplicate` / `webhook_ignored` | Duplicate or unsupported event | UNSET |
| `timeout` / `provider_error` / `error` | PayPal/DB/unexpected | ERROR |

## Metrics

HTTP: `http.server.request.count`, `http.server.request.duration`, `http.server.errors`  
Attributes: `http.request.method`, `http.route` (normalized Express route, or `unmatched`), `http.response.status_code`

Database: `db.client.operation.duration`, `db.client.errors`  
Attributes: `db.system=postgresql`, `db.operation`, `db.collection`

PayPal: `paypal.client.request.count`, `paypal.client.errors`, `paypal.client.timeouts`, `paypal.client.request.duration`  
Attribute: `paypal.operation` (`orders_create`, `orders_get`, `orders_capture`, `oauth_token`)

Business counters (no labels):

- `orders.created`, `orders.creation_failed`, `orders.idempotency_replay`, `orders.idempotency_conflict`
- `reservations.created`, `reservations.conflict`, `reservations.expired`
- `payments.confirmed`, `payments.failed`
- `paypal.webhooks.received`, `paypal.webhooks.duplicate`, `paypal.webhooks.ignored`, `paypal.webhooks.failed`

There is no `orders.pending` gauge. That would scrape PostgreSQL on a timer; query `Order` where `paymentStatus = PENDING` when you need the count.

## Local export

```bash
# log correlation only (no exporter)
OTEL_ENABLED=true npm run dev

# print spans/metrics to stdout
OTEL_ENABLED=true OTEL_EXPORTER=console npm run dev

# optional collector; the API still starts if it is down
OTEL_ENABLED=true OTEL_EXPORTER=otlp OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 npm run dev
```

Tests start an in-memory exporter via `startTestTelemetry()`. They do not need `OTEL_ENABLED`.

## Security exclusions

Telemetry must not include:

- passwords
- JWTs / refresh tokens
- `Authorization` headers
- PayPal access tokens
- webhook signatures (`paypal-transmission-sig`)
- payment credentials
- SQL text or bind parameters
- user / order / listing IDs as metric labels
- raw URLs or query strings as metric dimensions

`safeAttributes()` drops forbidden keys and bearer/JWT-looking values before they reach a span or metric.

See `docs/adr/0004-opentelemetry.md`.
