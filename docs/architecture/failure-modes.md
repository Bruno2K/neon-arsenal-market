# Failure Modes

This is the operational map of how Neon Arsenal fails and recovers. PostgreSQL remains authoritative for business state. PayPal and Resend are unreliable from the application's point of view.

## External HTTP

| Call | Timeout | Retry | Duplicate risk | Recovery if the process dies after a remote success |
|---|---|---|---|---|
| PayPal `OrdersCreate` | `PAYPAL_API_TIMEOUT_MS` (10s) | None | A retry would open a second PayPal order | Buyer retries `POST /payments` or `POST /orders` with the same idempotency key. Orphan PayPal orders are not captured locally. |
| PayPal `OrdersCapture` | same | None | Capture can move funds | Webhook `PAYMENT.CAPTURE.COMPLETED` or GET reconciliation. |
| PayPal `OrdersGet` | same | 3 attempts, 5xx/429/timeout/network, exponential backoff | Read-only | Next reconciliation sweep. |
| PayPal OAuth token | same | same as GET | Read-only token | Next call fetches a new token. |
| PayPal webhook cert download | same | same as GET | Read-only | Next webhook retries; PayPal retries the delivery. |
| Resend verification email | `EMAIL_API_TIMEOUT_MS` (10s) | 3 attempts, 5xx/429/timeout/network | Same code may be emailed twice if Resend accepted after our timeout | User uses the code from either email. 4xx is not retried. |

Classification lives in `server/src/shared/resilience/retry.ts`. Circuit breakers are not used.

## Payments and webhooks

- Duplicate PayPal events: unique `(provider, externalEventId)` plus `confirmPayment` claim. See `docs/adr/0002-paypal-webhook-reliability.md`.
- Out-of-order `CHECKOUT.ORDER.APPROVED` then capture: approved events are stored as `IGNORED`; only `PAYMENT.CAPTURE.COMPLETED` sells listings.
- Capture after reservation expiry: local confirm rolls back; webhook returns HTTP 200 so PayPal stops; money captured then needs an operational refund.
- Capture that cannot resolve a local order yet: HTTP 503 so PayPal retries.
- Process crash after PayPal capture and before local commit: webhook retry or in-process GET reconciliation (60s, min age 2 minutes, batch 20).

## Reservations and orders

- Two buyers, one listing: one `ACTIVE → RESERVED` conditional update wins. See `docs/architecture/domain-invariants.md`.
- Expiry vs payment: expiry cannot overwrite `SOLD`; payment cannot sell an expired or re-reserved listing. See `docs/adr/0001-in-process-reservation-expiry.md`.
- Duplicate `POST /orders`: customer `Idempotency-Key` in the same transaction as the reservation. See `docs/adr/0003-order-creation-idempotency.md`.

## Process lifecycle

On SIGTERM/SIGINT the API:

1. Marks itself shutting down (`GET /ready` returns 503 `shutting_down`).
2. Stops reservation-expiry and PayPal-reconciliation timers (in-flight sweeps may finish).
3. Stops accepting new HTTP connections and drains in-flight requests for up to 10s, then closes remaining connections.
4. Disconnects Prisma.
5. Shuts down OpenTelemetry exporters.

`GET /health` remains 200 until exit so liveness probes do not kill a draining instance early. New work is refused by `server.close()` and by `/ready`.

A crash during shutdown is the same as any other crash: PostgreSQL constraints plus webhook/reconciliation recover payment; the next process starts new job timers.

## What this document does not add

No Redis, Kafka, SQS, or extra worker service. Those would only be justified by a measured bottleneck (for example expiry delayed by a frozen event loop on every replica).
