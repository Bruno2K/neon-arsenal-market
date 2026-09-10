# ADR 0025 — Keep outbound PayPal mechanics behind one Payments gateway

## Status

Accepted

## Context

`payments.service.ts` directly consumed PayPal order creation, capture, lookup, approval-link parsing, status helpers, and the provider-specific already-captured error predicate. `refunds.service.ts` separately consumed capture-refund POST, refund GET, PayPal status types, and PayPal error-message classification. The application services still correctly owned PostgreSQL transactions, reservation validation, ledger mutations, webhook state, and reconciliation policy, but focused tests had to mock low-level functions from two provider implementation modules.

ADR 0016 rejected a broad Payments layering rewrite because it could obscure the `confirmPayment` transaction. ADR 0024 explicitly left a future payment/refund provider seam available if it showed measurable testability benefit. PR09 found that a narrow outbound PayPal gateway provides that benefit without moving any business or persistence responsibility.

## Decision

1. `paypal-provider.gateway.ts` is the only outbound PayPal dependency consumed by payment and refund application services.
2. The gateway owns Orders create/get/capture calls, the already-captured GET fallback, approval-link normalization, refund POST/GET calls, and refund failure classification.
3. The contract is deliberately PayPal-specific. It is not a generic multi-provider framework and does not predict a Stripe implementation.
4. Payment and refund application services continue to own orchestration, trusted status decisions, reservation checks, durable claims, bounded reconciliation, PostgreSQL transactions, ledger changes, and compensation.
5. Prisma remains explicit. Provider calls remain outside critical PostgreSQL transactions.
6. Webhook signature verification and parsing remain separate inbound trust-boundary utilities; this ADR covers outbound provider I/O only.
7. Existing low-level PayPal utilities remain the concrete SDK/HTTP implementation and keep their observability, timeout, and retry semantics.

## Evidence

| Signal | Before | After | Benefit |
|---|---:|---:|---|
| Low-level outbound PayPal modules imported by application services | 2 | 0 | Services depend only on the gateway |
| Outbound PayPal symbols imported directly by `payments.service.ts` | 9 | 0 | Order orchestration no longer knows helper layout or capture replay mechanics |
| Outbound PayPal symbols imported directly by `refunds.service.ts` | 3 | 0 | Refund execution and observation use one contract |
| Provider modules mocked by focused refund reconciliation tests | 2 | 1 | One small provider object represents POST and GET behavior |
| Low-level PayPal functions mocked by the focused payment service suite | 7 | 0 | Application behavior is isolated from SDK/HTTP implementation details |
| Provider-specific refund failure classification in application services | 1 | 0 | Normalization lives at the provider boundary |

The improvement is structural and test-visible; it does not rely on lower line count or hypothetical future providers.

## Rejected alternatives

- **Cancel PR09:** rejected because direct-import and mock counts demonstrate concrete coupling reduction.
- **Generic `PaymentProvider` framework:** rejected because PayPal is the only provider and speculative extensibility adds cost.
- **Prisma repositories or a DI container:** rejected because neither is required for the seam and both would broaden risk.
- **Move webhook trust into the gateway:** rejected because inbound authenticity is a distinct security boundary.

## Consequences

- Focused application tests can replace one `paypalProvider` object.
- Low-level PayPal parsing/HTTP tests remain focused on the concrete utilities and refund client.
- The gateway is a small module-local seam; Payments remains one application service and all transactional invariants remain visible.
- Some intentional coupling remains: application logic knows PayPal status labels and webhook event semantics because PayPal is the current provider.

## Rollback

Restore direct utility imports in the two services, move capture replay and refund classification back, and delete the gateway and its focused test. No data or API rollback is required.

## Amends

- ADR 0016: Payments remains unsplit, but outbound PayPal mechanics now have an explicit module-local gateway rather than being consumed directly from `shared/utils`.
- ADR 0024: implements only the optional provider seam anticipated there; refund semantics are unchanged.
