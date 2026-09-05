# ADR 0002 — PayPal webhook reliability

## Status

Accepted

## Context

PayPal webhooks can duplicate, arrive out of order, retry after timeouts, and be delivered after a process crash. Local payment confirmation must remain atomic with listing sale and seller payout. The system is a modular monolith: PostgreSQL is the source of truth. A queue, Redis, or extra scheduler is not justified.

Official PayPal verification is RSA-SHA256 over `transmissionId|timestamp|webhookId|crc32(rawBody)` using the certificate at `paypal-cert-url`. See [PayPal webhook message verification](https://developer.paypal.com/api/rest/webhooks/rest/#link-messageverification). `CHECKOUT.ORDER.APPROVED` means the buyer approved the order; it does not mean funds were captured. Capture is `PAYMENT.CAPTURE.COMPLETED`.

## Decision

1. Verify webhooks cryptographically (self-verify). Do not post back to PayPal for the authenticity check on the request path. Production refuses events when `PAYPAL_WEBHOOK_ID` is missing. Certificate URLs must be HTTPS on PayPal hosts.
2. Persist each PayPal event id in `PaymentWebhookEvent` with a unique `(provider, externalEventId)` constraint. Duplicates are no-ops once `PROCESSED` or `IGNORED`. `RECEIVED`/`FAILED` rows may be retried.
3. Apply local payment only on `PAYMENT.CAPTURE.COMPLETED`. Store `CHECKOUT.ORDER.APPROVED` as `IGNORED` (intermediate). Other types are ignored.
4. Keep payment confirmation in one PostgreSQL transaction: claim the unpaid order, sell listings that this order still holds (`RESERVED` + `reservedByOrderId` + unexpired TTL), create `SellerTransaction`, increment seller balance. Any failure rolls back.
5. Bind the reservation to the order via `reservedByOrderId` so a stale capture cannot sell a listing later reserved by another buyer.
6. Recover lost captures with an in-process GET of PayPal order status (interval 60s, min age 2 minutes, batch 20). GET may retry 5xx/429. `OrdersCreate` is never retried because it can create a second PayPal order.
7. HTTP timeouts default to `PAYPAL_API_TIMEOUT_MS` (10s). Expired-reservation captures return HTTP 200 so PayPal stops retrying a business rule. Unresolved local orders return HTTP 503 so PayPal retries.

Rejected alternatives: Redis/set for idempotency (not durable, not multi-instance); Kafka/SQS (no demonstrated throughput need); verifying via PayPal postback on every webhook (extra network dependency on the request path).

## Consequences

- Multiple API replicas can process the same webhook; the unique constraint plus the order claim prevent double payout.
- A crash after PayPal capture and before local commit is recovered by webhook retry or the GET reconciliation sweep.
- Money captured after the reservation expired requires operational handling (refund); the marketplace will not mark the listing `SOLD`.
