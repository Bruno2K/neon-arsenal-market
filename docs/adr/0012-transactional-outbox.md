# ADR 0012 — Transactional outbox (in-process)

## Status

Accepted

## Context

Issue #46. Payment confirmation already mutates order, listings, seller ledger, and audit in one PostgreSQL transaction. Downstream consumers (metrics, later integrations) must not run inside that transaction, and must not require a second `confirmPayment`. A lost in-process side effect after commit should be retryable without duplicating the domain write.

The project is a modular monolith. PostgreSQL is the source of truth. Redis, Kafka, RabbitMQ, SQS, and a broker-backed worker are forbidden here (ADR 0007 keeps Render; issue #53 SQS is a later, separate decision). In-process jobs already exist: reservation expiry, PayPal GET reconciliation, seller-ledger reconciliation (`setInterval` + `unref`).

PayPal `OrdersCreate` / `OrdersCapture` stay unretried. Outbox processing is local database work plus structured logs/metrics, not a PayPal call.

## Decision

1. Persist an `OutboxEvent` row in the **same local database transaction** as the domain mutation that produced it. PayPal HTTP stays outside that transaction.
2. First events: `PAYMENT_CONFIRMED` and `ORDER_CONFIRMED`, both written from `paymentsService.confirmPayment` because that path already transitions `paymentStatus PENDING → PAID` and `status PENDING → CONFIRMED` together. Duplicate confirm (`updateMany` count = 0) does not insert.
3. Schema: `id`, `type`, `aggregateId`, `payload` (non-secret JSON), `status` (`PENDING` / `PROCESSING` / `PUBLISHED` / `FAILED`), `attempts`, `availableAt`, `claimedAt`, `lastError`, `createdAt`. Unique `(type, aggregateId)` is defense in depth against double-insert. Payload is order id and statuses only; tokens, passwords, and PayPal secrets are never stored (writers sanitize known secret keys).
4. Dispatch with the existing in-process job pattern: interval + `unref`, started from `startApiProcess`. Claim due `PENDING` rows, or stale `PROCESSING` rows (crash after claim), with `FOR UPDATE SKIP LOCKED`. Bounded retries with exponential backoff; then `FAILED`. Re-processing a `PUBLISHED` row (conditional `PROCESSING → PUBLISHED`) is a no-op.
5. First handler is structured log + counters (`outbox.published` / `outbox.retry` / `outbox.failed`). It does **not** call `confirmPayment` again and does not write seller ledger. Optional `AuditLog` is omitted here because payment confirmation already records `PAYMENT_CONFIRMED` in the domain transaction.
6. Do not implement SQS, SNS, Kafka, or a second process. Multiple API replicas are safe because claim uses skip-locked rows.

## Rollback

Drop `OutboxEvent` and `OutboxEventStatus`. Remove the enqueue calls and the dispatcher job from `startApiProcess`. Domain confirmation, webhook authenticity, and PayPal capture semantics are unchanged.

## Consequences

- A thrown listing-sell / ledger failure rolls back the outbox row with the payment claim.
- A process crash after confirm commit and before publish leaves `PENDING` (or stale `PROCESSING`) rows; the next sweep publishes them.
- Handler logs/metrics may repeat if a crash lands after the handler and before `PUBLISHED`; the domain effect does not. Publish metrics increment only on a successful status transition.
- This is not a general event bus. New event types are added per use case, still in the producing transaction.
