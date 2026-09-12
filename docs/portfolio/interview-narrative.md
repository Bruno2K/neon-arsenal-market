# Five-minute backend interview narrative

This is the concise technical walkthrough for Neon Arsenal Market. It describes the current repository and its evidence; it is not a target architecture or a product roadmap.

## 30 seconds — what the project is

Neon Arsenal is a marketplace for unique Counter-Strike 2 skins with a React/Vite storefront and a TypeScript/Express modular-monolith API backed by PostgreSQL through Prisma. I built it as a Senior Backend portfolio case study: the important parts are concurrency over unique inventory, payment failure recovery, exact financial state, and evidence that can be tested and operated. The current public topology is Vercel frontend → Render API → Render PostgreSQL, with PayPal, Resend, and optional cs2.sh outside the process.

## 90 seconds — unique-item concurrency

The core race is two buyers trying to acquire the same unique listing. The invariant is stronger than “both requests usually do not succeed”: at most one order may own a valid hold, and a later payment may sell only the listing still reserved by that order.

Order creation writes the customer-scoped idempotency claim, order, items, price snapshots, and a conditional `ACTIVE → RESERVED` listing transition in one PostgreSQL transaction. The reservation stores `reservedByOrderId` and an expiry. PostgreSQL uniqueness serializes retries of the same business request, while the conditional update chooses one winner when different requests compete for the same listing.

The expiry loop is in-process, but correctness is in the database transition. It releases only an expired `RESERVED` row and cannot overwrite `SOLD`. Payment confirmation independently requires `RESERVED`, the same order owner, and an unexpired TTL; if every item cannot transition, the transaction rolls back. Real PostgreSQL tests exercise the concurrent winner, rollback, expiry, and payment-versus-expiry races.

Evidence: [`INV-LISTING-EXCLUSIVE-RESERVE`](../domain/invariants.md#inv-listing-exclusive-reserve), [`ADR 0001`](../adr/0001-in-process-reservation-expiry.md), [`ADR 0003`](../adr/0003-order-creation-idempotency.md), [reservation lifecycle](../../server/src/__tests__/reservation.lifecycle.integration.test.ts), and [transaction/concurrency](../../server/src/__tests__/postgres.transactions.integration.test.ts) tests.

## 90 seconds — reliable payment, refunds, and reconciliation

Payment is an end-to-end state machine, not a successful client redirect. A durable `PaymentLink` claim is stored before PayPal `OrdersCreate`, so duplicate local requests replay one result and concurrent calls do not create two links. A narrow Payments-owned gateway contains outbound PayPal mechanics; business orchestration and Prisma transactions stay visible in the application services. Provider network calls do not run inside critical PostgreSQL transactions.

The client cannot mark an order paid. `APPROVED` only means buyer approval; local confirmation requires trusted PayPal `COMPLETED` state from a verified webhook, return-page capture, or reconciliation. Webhook events have durable provider identity, so duplicates and out-of-order delivery converge. Confirmation atomically claims the pending order, validates the live reservation, moves listings to `SOLD`, writes seller ledger credit and balance projection, and inserts outbox events.

The hardest failure is remote capture succeeding after the reservation was lost or expired. The system does not steal a listing back or pretend payment failed. It creates one durable full-refund obligation, reuses a stable PayPal request identity, and reconciles ambiguous or remote-success/local-crash outcomes. Only trusted remote completion finalizes the local refund. If seller credit existed, compensation is a separate append-only ledger movement; history is never erased.

Evidence: [`ADR 0002`](../adr/0002-paypal-webhook-reliability.md), [`ADR 0012`](../adr/0012-transactional-outbox.md), [`SPEC-0013`](../specs/SPEC-0013-refund-financial-compensation.md), [`ADR 0024`](../adr/0024-refund-compensation.md), [`ADR 0025`](../adr/0025-paypal-provider-boundary.md), the [payment](../../server/src/__tests__/payment.link.idempotency.integration.test.ts), [webhook](../../server/src/__tests__/paypal.webhook.integration.test.ts), [refund](../../server/src/__tests__/refund.execution.integration.test.ts), and [reconciliation](../../server/src/__tests__/refund.reconciliation.integration.test.ts) tests, and the [refund runbook](../operations/runbook.md#refund-reconciliation).

## 60 seconds — operations and performance evidence

`/health` is process liveness; `/ready` checks PostgreSQL and returns 503 during shutdown. Render routes on `/ready`, while Docker uses `/health`. Pino request IDs work without extra infrastructure; when OpenTelemetry is enabled, logs include trace/span IDs and the API emits HTTP, Prisma, PayPal, workflow, reconciliation, ledger, and outbox instruments. Recovery loops are idempotent against PostgreSQL, and the runbook gives read-only diagnosis and safe reconciliation procedures.

For performance, the claim is deliberately bounded. In GitHub Actions, three serial repetitions used the same frozen production API image, 1 CPU/512 MiB for the API, 1 CPU/1 GiB for PostgreSQL, and a configured catalog hold of 150 RPS for 60 seconds. All three had zero HTTP failures and zero dropped iterations. Repeated 200 RPS runs were unstable and showed API CPU as the first boundary while PostgreSQL remained in the low teens. That is controlled-CI evidence, not Render or production capacity.

Evidence: [capacity](../architecture/capacity.md), [k6 report](../performance/load-test-report-2026-09-10-catalog.md), [SLOs](../operations/slos.md), and [runbook](../operations/runbook.md).

## 30 seconds — architecture trade-offs

The backend stays a modular monolith because one deployable and one transactional database make the critical invariants explicit. PostgreSQL coordinates reservations, idempotency, ledger state, webhook identity, and outbox claims. I deliberately did not add microservices, Redis, Kafka, SQS, a distributed lock, or a generic multi-provider framework. Current limitations include in-process jobs and rate-limit counters, one PostgreSQL primary, PayPal as the sole provider, and demo seed behavior in the portfolio environment.

## 30 seconds — conditional scaling path

Scaling follows measurements. If API CPU saturates while the database has headroom, test more CPU or Render API replicas and preserve the PostgreSQL connection budget. If database connections, queries, locks, or I/O become the limit, profile and tune queries, indexes, pagination, and pooling before scaling PostgreSQL. Add an external worker or queue only if in-process recovery shows sustained coordination lag. Add a shared rate-limit store only if multiple replicas need coordinated counters. Each step needs new evidence and, when architectural, a reviewed ADR.

Details: [scaling path](../architecture/scaling-path.md) and [capacity model](../architecture/capacity.md).
