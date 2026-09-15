# Operational signal inventory

This is the canonical inventory of signals emitted by the current modular monolith. Instrument existence is code/static evidence; a passing automated test proves emission behavior in its test environment. Neither proves that a production collector received the signal. Production OTLP export remains **not proven** as of the PR12 evidence window.

Metrics intentionally avoid order, listing, refund, user, and provider identifiers as labels. Those identifiers belong in bounded logs and spans. `safeAttributes()` removes secret-like keys and bearer/JWT-looking values.

## Metrics

| Operational question | Instrument | Attributes | Emitted from | Alert or diagnostic use | Production observed? |
|---|---|---|---|---|---|
| What is request rate? | `http.server.request.count` | method, route pattern, status code | `shared/observability/http.ts` | Rate and status mix by route | No |
| Which requests are slow? | `http.server.request.duration` (s) | method, route pattern, status code | `shared/observability/http.ts` | p50/p95/p99 and latency targets | No |
| Which routes return server errors? | `http.server.errors` | method, route pattern, status code | `shared/observability/http.ts` | Availability numerator; investigate above 1%/15m | No |
| Is PostgreSQL slow or failing? | `db.client.operation.duration`, `db.client.errors` | `db.system`, operation, model | `shared/observability/prisma.ts` | DB latency/failure split without SQL or bind values | No |
| Is PayPal slow, failing, or timing out? | `paypal.client.request.count`, `.duration`, `.errors`, `.timeouts` | operation; optional status code | `shared/observability/paypal.ts` | Provider health; any timeout is actionable | No |
| Are order attempts succeeding or replaying? | `orders.created`, `.creation_failed`, `.idempotency_replay`, `.idempotency_conflict` | none | `modules/orders/orders.service.ts` | Separate healthy retries from conflicts/failures | No |
| Are exclusive reservations contended or expiring? | `reservations.created`, `.conflict`, `.expired` | none | order/listing services and expiry job | Collision and hold-expiry trend | No |
| Are trusted payments confirming locally? | `payments.confirmed`, `.failed` | none | `modules/payments/payments.service.ts` | Confirmation outcome; use span outcome to separate expected expiry | No |
| Are webhooks accepted, duplicated, ignored, or rejected? | `paypal.webhooks.received`, `.duplicate`, `.ignored`, `.failed` | none | `modules/payments/payments.controller.ts` and service | Delivery and idempotency investigation | No |
| Is seller balance projection drifting? | `seller.ledger.drift_detected`, `.corrected` | none | commissions reconciliation | Any drift requires investigation; correction should follow | No |
| Are refunds converging? | `refund.reconciliation.scanned`, `.attempted`, `.converged`, `.still_pending`, `.retryable_failure`, `.terminal_failure`, `.operator_required` | none | `modules/payments/refunds.service.ts` | Pending/retry/terminal/operator paths | No |
| Is durable work publishing or exhausting retries? | `outbox.published`, `.retry`, `.failed` | none | `shared/outbox/outbox.dispatcher.ts` | Any terminal failure; retry trend | No |

There is no readiness counter, pending-order gauge, refund-age gauge, reconciliation-lag histogram, or outbox-backlog gauge. `/health` and `/ready` are deliberately excluded from HTTP telemetry. Readiness is observed by the Render probe and direct HTTP checks; backlog and age are read from PostgreSQL with the runbook queries. This is an explicit limit, not an implied zero.

## Logs and spans

| Activity | Safe correlation fields | Principal spans/logs | Operator use |
|---|---|---|---|
| HTTP request | `requestId`, `trace_id`, `span_id` | `http.server.request`; Pino mixin | Join a response to logs and a trace |
| Order/reservation | `order.id`, `listing.id` in spans where defined | `orders.create`, `.transaction`, `listings.reserve`, `listings.expire` | Locate conflicts, expiry, and transaction duration |
| PayPal create/get/capture | order id plus safe PayPal order/capture identifiers | `payments.create_link`, `payments.capture`, `payments.confirm`, `paypal.*` | Separate provider I/O from local confirmation |
| Webhook | event id/type and order id | `paypal.webhook.verify`, `.handle`; received/duplicate/processed logs | Prove verification and duplicate handling |
| Refund | `refundId`, `orderId`, provider capture/refund ids, before/after status, reason | `refund.reconcile.sweep`, `refund.reconcile`; convergence/retry/operator logs | Track one obligation without logging payloads |
| Reconciliation | scanned/confirmed or refund outcome counts | `payments.reconcile`, `refund.reconcile.sweep`, `seller.ledger.reconcile` | Determine progress and stalled work |
| Outbox | outbox event id, type, aggregate id, attempts | `outbox.dispatch`; publish/retry/failure logs | Reclaim and terminal-failure diagnosis |
| Shutdown | signal and draining state | graceful-shutdown logs | Explain readiness transition and interrupted requests |

Provider identifiers are operational identities, not secrets, but access to them still belongs to authorized operators. Never log PayPal credentials, access tokens, full webhook payloads, `Authorization`, verification codes, email addresses as search keys, or database URLs.

## Correlation boundary

The normal chain is:

```text
X-Request-Id
  -> Pino requestId (+ trace_id/span_id while a span is active)
  -> http.server.request request.id
  -> workflow span with order/refund/provider IDs
  -> PostgreSQL rows queried by durable business ID
```

Background sweeps do not inherit an inbound request ID. Start with their span/log name, then pivot on the durable `orderId`, `refundId`, provider id, or outbox aggregate id. When OTLP is disabled or unavailable, the chain stops at Render logs plus read-only SQL; operators must not invent a trace correlation layer.
