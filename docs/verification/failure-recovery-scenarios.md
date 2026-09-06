# Failure and recovery scenarios (#56)

Executable evidence for external PayPal failures, PostgreSQL unavailability, health vs readiness, transactional rollback, and consistency after recovery.

This document records **existing behavior**. It does not add Redis, Kafka, SQS, a circuit-breaker library, or a refund API.

## Policy under test

| Call | Timeout | Retry | Fail-fast | Circuit breaker |
|---|---|---|---|---|
| PayPal `OrdersCreate` | `PAYPAL_API_TIMEOUT_MS` (default 10s) | **None** — a retry can open a second PayPal order | Yes | Not used (ADR 0005) |
| PayPal `OrdersCapture` | same | **None** — a retry can capture funds twice | Yes | Not used |
| PayPal `OrdersGet` | same | 3 attempts, 5xx / 429 / timeout / network, exponential backoff 200ms × 2^(n-1) | After 3 attempts | Not used |
| PayPal OAuth token | same | same as GET | After 3 attempts | Not used |
| PayPal webhook cert download | same | same as GET | After 3 attempts | Not used |
| PostgreSQL | Prisma | No application retry of business writes | `/ready` returns 503 | N/A |
| Redis | **Not in this repository** | N/A | N/A | N/A |

Classification: `server/src/shared/resilience/retry.ts`. Policy constants: `PAYPAL_HTTP_POLICY` in `server/src/shared/utils/paypal.ts`. Narrative: `docs/architecture/failure-modes.md`, `docs/adr/0005-external-retry-and-graceful-shutdown.md`.

## Scenarios and results

| ID | Scenario | Expected result | Evidence |
|---|---|---|---|
| FR-01 | PayPal HTTP 429 on an idempotent lookup | Retry with 200ms then 400ms backoff; succeed on a later attempt | `retry.test.ts` (429 backoff); `paypal.failure-recovery.test.ts` (OrdersGet 429 → COMPLETED) |
| FR-02 | PayPal HTTP 5xx on OAuth / OrdersGet / cert download | Retry up to 3 attempts, then surface the error | `paypal.failure-recovery.test.ts`; `paypalWebhook.test.ts` (cert 503 then 200; 4xx not retried) |
| FR-03 | PayPal timeout / AbortError on OrdersGet | Classified retryable; after exhaustion maps to `AppError(504)` | `retry.test.ts`; `paypal.failure-recovery.test.ts` |
| FR-04 | PayPal HTTP 4xx on OrdersGet | Fail-fast; no second attempt | `paypal.failure-recovery.test.ts` |
| FR-05 | PayPal `OrdersCreate` / `OrdersCapture` failure | **Not retried** (fail-fast). Local `PaymentLink` IN_PROGRESS row is released so a client retry can claim again | `PAYPAL_HTTP_POLICY`; `paypal.orders-create.test.ts`; `payments.service.test.ts`; `payment.link.idempotency.integration.test.ts` |
| FR-06 | Recovery after a failed lookup | A later OrdersGet succeeds once PayPal is healthy; token cache is reused | `paypal.failure-recovery.test.ts` |
| FR-07 | PostgreSQL unreachable | `GET /health` stays 200 (liveness). `GET /ready` returns 503 `unavailable`. Integration suite **fails closed** (not skipped) | `health.test.ts`; `require-postgres.test.ts`; `docs/testing.md` |
| FR-08 | Process shutting down | `/health` 200; `/ready` 503 `shutting_down` without querying PostgreSQL | `health.test.ts` |
| FR-09 | Mid-transaction throw | Order, items, reservation, and idempotency key roll back together | `postgres.transactions.integration.test.ts` |
| FR-10 | Payment confirmation vs expired reservation | Local claim rolls back; listing is not `SOLD`; no seller ledger row | `paypal.webhook.integration.test.ts`; `payments.service.test.ts` |
| FR-11 | Duplicate / concurrent webhook after recovery | Unique `(provider, externalEventId)` + `confirmPayment` claim; one `SellerTransaction` | `paypal.webhook.integration.test.ts`; `checkout.concurrency.integration.test.ts` |
| FR-12 | Redis unavailable | **N/A.** No Redis client, cache, or rate-limit store. In-process memory limiter only. ADR 0007 keeps Render; a Redis ADR is required before adding it | This document |

## What was not added

- No circuit-breaker library. ADR 0005: provider blips and process replacement, not a measured retry storm. Fail-fast on mutating PayPal calls is the control.
- No Redis unavailability harness. There is nothing to take down.
- No invented PayPal refund/void path for capture-after-expiry. That remains an open human decision in `docs/architecture/failure-modes.md`.

## How to re-run

```bash
cd server
npm run test:unit
npm run test:integration
```
