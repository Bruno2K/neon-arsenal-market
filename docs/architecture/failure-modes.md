# Failure Modes

This is the operational map of how Neon Arsenal fails and recovers. PostgreSQL remains authoritative for business state. PayPal and Resend are unreliable from the application's point of view.

## External HTTP

| Call | Timeout | Retry | Duplicate risk | Recovery if the process dies after a remote success |
|---|---|---|---|---|
| PayPal `OrdersCreate` | `PAYPAL_API_TIMEOUT_MS` (10s) | None | A retry would open a second PayPal order | `POST /payments` first inserts `PaymentLink(orderId)`. A completed link or existing `paypalOrderId` is replayed without `OrdersCreate`. Concurrent retries serialize on the unique order id. If the process dies after PayPal accepts create but before the local transaction commits, the `IN_PROGRESS` row remains; the next request returns 409 until the row is completed or removed. That orphan PayPal order is not captured locally. |
| PayPal `OrdersCapture` | same | None | Capture can move funds | Webhook `PAYMENT.CAPTURE.COMPLETED` or GET reconciliation. |
| PayPal `OrdersGet` | same | 3 attempts, 5xx/429/timeout/network, exponential backoff | Read-only | Next reconciliation sweep. |
| PayPal OAuth token | same | same as GET | Read-only token | Next call fetches a new token. |
| PayPal webhook cert download | same | same as GET | Read-only | Next webhook retries; PayPal retries the delivery. |
| Resend verification email | `EMAIL_API_TIMEOUT_MS` (10s) | 3 attempts, 5xx/429/timeout/network | Same code may be emailed twice if Resend accepted after our timeout | User uses the code from either email. 4xx is not retried. |

Classification lives in `server/src/shared/resilience/retry.ts`. Circuit breakers are not used.

Test evidence for timeout / 5xx / 429, fail-fast mutating calls, PostgreSQL vs `/health`/`/ready`, transactional rollback, and Redis N/A: [`docs/verification/failure-recovery-scenarios.md`](../verification/failure-recovery-scenarios.md) (#56).

## Payments and webhooks

- Duplicate PayPal events: unique `(provider, externalEventId)` plus `confirmPayment` claim. See `docs/adr/0002-paypal-webhook-reliability.md`.
- Out-of-order `CHECKOUT.ORDER.APPROVED` then capture: approved events are stored as `IGNORED`; only `PAYMENT.CAPTURE.COMPLETED` sells listings.
- Capture after reservation expiry: local fulfillment still rolls back; trusted completed capture state creates one durable full-refund obligation for reconciliation. See **Capture after reservation expiry** below, ADR 0024, and `docs/operations/runbook.md`.
- Capture that cannot resolve a local order yet: HTTP 503 so PayPal retries.
- Process crash after PayPal capture and before local commit: webhook retry or in-process GET reconciliation (60s, min age 2 minutes, batch 20).

## Capture after reservation expiry

This is a distributed partial failure between PayPal and PostgreSQL. Unique listings must not become `SOLD` after the hold expired, while the captured buyer funds must converge through a durable full technical refund.

### What the code does (inspected)

- `server/src/shared/utils/paypal.ts` uses PayPal Orders for checkout and PayPal Payments v2 for full capture refunds and refund lookup. Mutating calls are not blindly retried; refund replay uses the same deterministic provider request identity.
- `confirmPayment` sells listings only when they are still `RESERVED`, `reservedByOrderId` matches the paying order, and `reservationExpiresAt` is in the future. Otherwise it throws HTTP 409 and rolls back the local payment claim.
- When trusted PayPal state proves capture completion but fulfillment is impossible, the payment path creates or reuses the unique PostgreSQL `Refund` obligation without reclaiming or selling the listing.
- Refund reconciliation claims eligible rows, uses provider lookup when `providerRefundId` is known, and otherwise safely replays the refund with the stable request identity. Remote completion is the authority for local completion.
- Provider-confirmed completion updates local refund/payment state and appends any required seller-ledger compensation in one PostgreSQL transaction. If no seller credit existed, no synthetic seller debit is created.
- The expiry sweep may later set the listing `ACTIVE` and the unpaid order `CANCELLED`. A later buyer can reserve the listing. A stale capture still cannot sell it (`reservedByOrderId` must match).

Local end state after this failure (before or after the sweep):

| Field | Typical value |
|---|---|
| `Listing.status` | still `RESERVED` with `reservationExpiresAt` in the past, or `ACTIVE` after the sweep (or `RESERVED` by a later order) |
| `Order.paymentStatus` | remains unfulfilled while compensation is pending; becomes `REFUNDED` only after trusted provider completion |
| `Order.status` | `PENDING`, then `CANCELLED` after the sweep |
| `Refund` | one durable full-BRL obligation per provider capture, progressing through its explicit lifecycle |
| `SellerTransaction` | no payment credit for an unfulfilled order; if a credit already existed, completion appends a distinct exact compensation movement |
| PayPal | capture completed, then refund state reconciled until trusted completion or explicit operator-required evidence |

### Recovery and operator boundary

The refund flow is idempotent across duplicate webhooks, reconciliation, provider timeouts, and remote-success/local-crash recovery. It does not provide partial refunds, buyer-requested refunds, disputes, chargebacks, FX, or a public refund workflow. Those require separate product decisions.

Operators investigate terminal or unresolved obligations through the read-only procedure in `docs/operations/runbook.md`; they must not manually forge completion, ledger entries, a second refund row, or a new provider request identity. ADR 0024 and `docs/domain/invariants.md` own the durable semantics.

## Reservations and orders

- Two buyers, one listing: one `ACTIVE → RESERVED` conditional update wins. See `docs/domain/invariants.md` (`INV-LISTING-EXCLUSIVE-RESERVE`) and `docs/architecture/domain-invariants.md`.
- Expiry vs payment: expiry cannot overwrite `SOLD`; payment cannot sell an expired or re-reserved listing. See `docs/adr/0001-in-process-reservation-expiry.md`.
- Duplicate `POST /orders`: customer `Idempotency-Key` in the same transaction as the reservation. See `docs/adr/0003-order-creation-idempotency.md`.
- Duplicate `POST /payments`: unique `PaymentLink(orderId)` inserted before `OrdersCreate`. Replay returns the stored PayPal order id and approval URL. The PayPal client still does not retry `OrdersCreate`.

## Process lifecycle

On SIGTERM/SIGINT the API:

1. Marks itself shutting down (`GET /ready` returns 503 `shutting_down`).
2. Stops reservation-expiry, PayPal-reconciliation, seller-ledger-reconciliation, and outbox-dispatcher timers (in-flight sweeps may finish).
3. Stops accepting new HTTP connections and drains in-flight requests for up to 10s, then closes remaining connections.
4. Disconnects Prisma.
5. Shuts down OpenTelemetry exporters.

`GET /health` remains 200 until exit so liveness probes do not kill a draining instance early. New work is refused by `server.close()` and by `/ready`.

A crash during shutdown is the same as any other crash: PostgreSQL constraints plus webhook/reconciliation recover payment; unpublished outbox rows stay `PENDING` or stale `PROCESSING` and are claimed by the next process; the next process starts new job timers.

## Transactional outbox

Payment confirmation inserts `PAYMENT_CONFIRMED` and `ORDER_CONFIRMED` in the same local transaction as the domain write (`docs/adr/0012-transactional-outbox.md`). Duplicate confirm does not insert again. The in-process dispatcher claims with `FOR UPDATE SKIP LOCKED`, retries with bounded backoff, and treats a second publish of `PUBLISHED` as a no-op. The first handler is log + metric only; it does not confirm payment again. Crash after claim: stale `PROCESSING` rows are reclaimed. This is not SQS.

## What this document does not add

No Redis, Kafka, SQS, or extra worker service. Those would only be justified by a measured bottleneck (for example expiry delayed by a frozen event loop on every replica).
