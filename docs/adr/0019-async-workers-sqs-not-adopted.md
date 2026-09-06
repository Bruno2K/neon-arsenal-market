# ADR 0019 — Async workers and SQS are not adopted

## Status

Accepted

## Context

Issue #71 asks for an explicit decision on asynchronous processing. Issue #53 (SQS) is still a separate intake item; it must not be implemented while ADR 0007 keeps Render and there is no measured queueing trigger.

The API already runs **in-process** timers after `listen`: reservation expiry (30s), PayPal GET reconciliation (60s), seller-ledger reconciliation (60s), and the transactional outbox dispatcher (ADR 0012, `FOR UPDATE SKIP LOCKED`). Those are not a second deployable and not a broker.

## Decision

**Do not adopt SQS, SNS, Kafka, RabbitMQ, or a separate worker service.** Background work stays in the API process and is coordinated by PostgreSQL conditional updates.

Rejected alternatives:

- SQS + worker for webhooks or expiry — duplicates what unique constraints and `RESERVED`/`SOLD` predicates already serialize. Extra hop after PayPal would not make capture more reliable than webhook retry + GET reconcile (ADR 0002).
- A Render Background Worker that shares the same image — a second process that still needs the same DB invariants, plus split deploys, without a measured event-loop freeze.
- “Async” meaning fire-and-forget payment confirmation — forbidden. `confirmPayment` stays one local transaction.

## Consequences

- Sequence diagrams must not draw a queue or worker (`docs/architecture/sequences.md`).
- Extra API replicas duplicate timers; that is safe because sweeps are idempotent.
- A later SQS ADR would have to supersede this one **and** show a trigger from `docs/architecture/scaling-path.md` (for example expiry delayed by a frozen event loop on every replica). Until then, agents must not add AWS SQS.

## What this ADR does not change

- ADR 0012 (outbox stays in-process).
- PayPal `OrdersCreate` / `OrdersCapture` no-retry policy (ADR 0005).
- `render.yaml` (no worker service).
