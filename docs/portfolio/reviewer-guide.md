# Reviewer guide — 5 to 15 minutes

This path is for a hiring manager or Senior/Staff/Principal engineer who wants to evaluate Neon Arsenal Market without reading the whole repository. The central question is whether important backend claims are backed by explicit decisions, executable invariants, tests, and operational evidence.

## If you only have 5 minutes

1. Read the [README](../../README.md) for the system, engineering highlights, live demo, and known limits.
2. Read the [case study](case-study.md), especially “Hardest problems solved” and “Trade-offs and known limits.”
3. Scan the [evidence index](evidence-index.md) to test whether the claims lead to concrete proof.

What to look for: concurrency-safe unique inventory; trusted and idempotent payment state; recoverable refund/outbox workflows; honest operational and performance boundaries; deliberate rejection of unjustified distributed infrastructure.

## If you have 15 minutes

Follow the five-minute path, then:

4. Inspect the [current architecture](../architecture/current-state.md) and [C4 view](../architecture/c4.md).
5. Read the critical [domain invariants](../domain/invariants.md), particularly exclusive reservation, SOLD irreversibility, trusted payment confirmation, and the seller ledger.
6. Sample five decisions: [reservation expiry](../adr/0001-in-process-reservation-expiry.md), [webhook reliability](../adr/0002-paypal-webhook-reliability.md), [order idempotency](../adr/0003-order-creation-idempotency.md), [transactional outbox](../adr/0012-transactional-outbox.md), and [refund compensation](../adr/0024-refund-compensation.md).
7. Read the conclusions and remaining limits in the [PR11 final audit](../verification/final-senior-backend-audit-2026-09-14.md) and [PR12 operational proof](../verification/production-operational-proof-2026-09-15.md).
8. Check the bounded [performance report](../performance/load-test-report-2026-09-10-catalog.md) and [threat model](../architecture/threat-model.md).
9. Inspect the [CI workflow](../../.github/workflows/ci.yml): unit/integration tests, OpenAPI contracts, npm audit, Trivy, and builds are separate gates.

## If you want to inspect code

Use these narrow paths rather than browsing every module:

- **Reservation and cancellation:** [`listings.service.ts`](../../server/src/modules/listings/listings.service.ts), then the [reservation lifecycle](../../server/src/__tests__/reservation.lifecycle.integration.test.ts) and [checkout concurrency](../../server/src/__tests__/checkout.concurrency.integration.test.ts) suites.
- **Payment confirmation:** [`payments.service.ts`](../../server/src/modules/payments/payments.service.ts), then the [webhook](../../server/src/__tests__/paypal.webhook.integration.test.ts) and [payment-link idempotency](../../server/src/__tests__/payment.link.idempotency.integration.test.ts) suites.
- **Refund reconciliation:** [`refunds.service.ts`](../../server/src/modules/payments/refunds.service.ts), then the [execution](../../server/src/__tests__/refund.execution.integration.test.ts) and [reconciliation](../../server/src/__tests__/refund.reconciliation.integration.test.ts) suites.
- **Transactional outbox:** [`outbox.dispatcher.ts`](../../server/src/shared/outbox/outbox.dispatcher.ts) and the [PostgreSQL outbox suite](../../server/src/__tests__/outbox.integration.test.ts).
- **OpenAPI route inventory:** [`routeInventory.ts`](../../server/src/shared/docs/routeInventory.ts) and its [HTTP contract](../../server/src/__tests__/openapi.http.contract.test.ts).
- **Observability:** [`observability/`](../../server/src/shared/observability/) plus the [signal inventory](../operations/signal-inventory.md), [dashboards](../operations/dashboards.md), and [SLOs](../operations/slos.md).

## How to judge the evidence

The strongest claims have four layers: a durable rule or decision, an implementation mechanism, an executable test against the relevant failure mode, and an operational or verification record. Point-in-time reports do not override current source or invariants, and provider-level facts that were unavailable are marked **NOT PROVEN** rather than inferred.

The repository does not claim production scale or exactly-once distributed processing. Its claim is narrower: the current modular monolith makes consistency and recovery choices explicit, tests the hard database behaviors with PostgreSQL, and records where evidence ends.
