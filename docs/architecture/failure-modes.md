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
- Capture after reservation expiry: local confirm rolls back; webhook returns HTTP 200 so PayPal stops. Money may already be captured at PayPal. See **Capture after reservation expiry** below and `docs/operations/runbook.md`.
- Capture that cannot resolve a local order yet: HTTP 503 so PayPal retries.
- Process crash after PayPal capture and before local commit: webhook retry or in-process GET reconciliation (60s, min age 2 minutes, batch 20).

## Capture after reservation expiry

This is a split-brain between PayPal and PostgreSQL. It is intentional: unique listings must not become `SOLD` after the hold expired.

### What the code does (inspected)

- `server/src/shared/utils/paypal.ts` exposes `OrdersCreate`, `OrdersCapture`, and `OrdersGet`. There is **no** refund, void, or capture-reversal helper. `capturePayPalOrder` is defined and unused; checkout `intent` is `CAPTURE`, so funds move when the buyer approves on PayPal, not via that helper.
- `server/src/types/paypal.d.ts` declares only `OrdersCreateRequest` and `OrdersCaptureRequest`.
- `confirmPayment` sells listings only when they are still `RESERVED`, `reservedByOrderId` matches the paying order, and `reservationExpiresAt` is in the future. Otherwise it throws HTTP 409 and rolls back the local payment claim.
- On that 409, `handleWebhook` stores `PaymentWebhookEvent` as `FAILED` / `reservation_expired` and **returns**. The HTTP controller then responds **200**, so PayPal stops retrying.
- GET reconciliation that sees a remote `COMPLETED` order calls `confirmPayment` and, on 409, logs and skips. It does not create a refund.
- The expiry sweep may later set the listing `ACTIVE` and the unpaid order `CANCELLED`. A later buyer can reserve the listing. A stale capture still cannot sell it (`reservedByOrderId` must match).

Local end state after this failure (before or after the sweep):

| Field | Typical value |
|---|---|
| `Listing.status` | still `RESERVED` with `reservationExpiresAt` in the past, or `ACTIVE` after the sweep (or `RESERVED` by a later order) |
| `Order.paymentStatus` | `PENDING` |
| `Order.status` | `PENDING`, then `CANCELLED` after the sweep |
| `SellerTransaction` | none for this order |
| `PaymentWebhookEvent` | `FAILED`, `failureReason = reservation_expired` |
| PayPal | capture completed; funds moved |

### What this repository does not do

There is no in-app refund or void. Schema comments allow `Order.paymentStatus = REFUNDED`, but no code path sets it for this failure. R2 does **not** add a PayPal refund client, env var, or that transition. Guessing the PayPal contract would violate `docs/agents/decision-policy.md`.

Operator steps (dashboard only, until a human chooses an API) are in `docs/operations/runbook.md`.

### HUMAN decision required

Should Neon Arsenal later reverse captured funds automatically, and with which **existing** PayPal contract (dashboard-only vs a refund/void API already supported by the account)? Until that decision, do not implement refund code.

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
