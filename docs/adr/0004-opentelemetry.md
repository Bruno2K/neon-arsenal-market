# ADR 0004 — OpenTelemetry without an observability platform

## Status

Accepted.

## Context

Issue #7 needs enough tracing and metrics to diagnose latency, errors and business failures on order creation, reservation, PayPal webhooks and payment confirmation. The repository is a modular monolith whose local workflow is `npm run dev` plus PostgreSQL. Introducing Jaeger, Grafana, Prometheus, Tempo or an OpenTelemetry Collector would make local development depend on infrastructure the product does not need yet.

Pino and `X-Request-Id` already exist. Replacing them would break current operators and tests.

## Decision

Use official OpenTelemetry JS SDK packages only. Enable them with `OTEL_ENABLED`. Default is off.

Supported exporters:

- `none` (default) — spans exist in-process for log correlation when enabled, nothing is shipped
- `console` — only when `OTEL_EXPORTER=console`
- `otlp` — optional HTTP OTLP; the process does not fail if the endpoint is down

Keep the existing request ID. Add `trace_id` / `span_id` to the Pino mixin when a span is active. Propagate W3C `traceparent` when a client sends it.

Instrument only critical boundaries: HTTP server, Prisma operations (no SQL text or parameters), PayPal client operations, and explicit workflow spans for order creation, reservation, payment confirmation, webhooks and reconciliation.

Classify expected 4xx business results (`app.outcome`) without span `ERROR`. Reserve `ERROR` for 5xx, timeouts, provider failures and unexpected exceptions.

Metric attributes are limited to low-cardinality keys: HTTP method/route/status, Prisma operation/collection, PayPal operation name. No user, order, listing, email or token labels.

## Consequences

- `npm run dev` and the test suites work without a collector.
- Production can enable OTLP later without changing domain code.
- Pending-order gauges are not scraped from PostgreSQL; use a query or a future metric if that becomes an operational need.
- Automatic Prisma spans add some volume. They omit SQL and bind variables to avoid sensitive data and high cardinality.
