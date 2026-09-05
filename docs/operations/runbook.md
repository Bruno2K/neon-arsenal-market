# Operations runbook

PostgreSQL is the source of truth for listings, orders, and seller balances. PayPal is an unreliable external ledger. This file starts with the capture-after-expiry procedure (P-back **R2**). Deploy, health vs ready, shutdown drain, and `SEED_DEMO_DATA` belong in a later Render ops pass (P-back **O1**).

## Capture after reservation expiry

PayPal can capture funds after the local reservation TTL has elapsed. The marketplace **must not** mark the listing `SOLD` or pay the seller. That invariant is already implemented (`confirmPayment` 409 + webhook HTTP 200). Returning the money is **not** implemented in this repository.

### Code inspection (do not invent an API)

Inspected:

- `server/src/shared/utils/paypal.ts` — `createPayPalOrder`, `capturePayPalOrder` (unused), `getPayPalOrder`. No refund/void function.
- `server/src/types/paypal.d.ts` — only OrdersCreate and OrdersCapture types.
- `server/src/modules/payments/payments.service.ts` — expired capture → webhook event `FAILED` / `reservation_expired`; reconciliation skips the same 409.
- No `PAYPAL_*` refund environment variable exists.

Do not add a PayPal refund client, capture-void helper, or new env var until a human selects a provider contract.

### How to detect

1. Logs: `paypal webhook not applied: reservation expired` or `paypal reconciliation skipped: reservation expired`.
2. Database:

```sql
SELECT e."externalEventId", e.status, e."failureReason", e."orderId",
       o."paypalOrderId", o.status AS order_status, o."paymentStatus",
       i."listingId"
FROM "PaymentWebhookEvent" e
JOIN "Order" o ON o.id = e."orderId"
JOIN "OrderItem" i ON i."orderId" = o.id
WHERE e."failureReason" = 'reservation_expired'
ORDER BY e."receivedAt" DESC;
```

3. Confirm the listing is **not** `SOLD` and there is **no** `SellerTransaction` for that `orderId`.
4. In the PayPal account (sandbox or live, matching `PAYPAL_MODE`), open the captured payment for `Order.paypalOrderId`. If PayPal shows captured funds, local and remote ledgers disagree.

### What to do (manual, out of band)

Until the HUMAN decision below is answered:

1. Do **not** set `Listing.status = SOLD`.
2. Do **not** set `Order.paymentStatus = PAID` or create a `SellerTransaction`.
3. Do **not** call undocumented PayPal URLs from this app.
4. If funds were captured, reverse them in the **PayPal account UI** for that capture / order id (the same dashboard used to inspect sandbox or live payments). This runbook does not specify a REST path or request body; that would be inventing a contract this repo does not implement.
5. After a dashboard reversal, local rows stay `PENDING` / `CANCELLED` and `FAILED`. There is no local `REFUNDED` write path. Leave them; the listing is already eligible for another buyer once `ACTIVE`.
6. If the listing is still `RESERVED` with `reservationExpiresAt` in the past, the in-process expiry sweep (30s) will release it. Do not force `SOLD`.

### What not to do

- Replay the webhook hoping it will sell the listing. It will 409 again and stay `FAILED`.
- Rely on GET reconciliation to fix money. It will skip the 409 forever.
- Implement `OrdersCapture` retries or a new refund helper as part of incident response.

### HUMAN decision (required before any refund code)

1. **Decision:** Should capture-after-expiry stay dashboard-only, or should the API reverse funds automatically?
2. **Options:**
   - A. Dashboard only (current). Operators follow this runbook. No new PayPal contract in the repo.
   - B. Automated reverse, but only after documenting the **existing** PayPal API the account actually supports (refund vs void vs other), with timeout/idempotency, in a new activity — not guessed here.
3. **Consequences:** A leaves rare captured-but-unsold money as a manual process. B without an inspected contract risks calling the wrong PayPal operation (voiding an already-captured order, double-refund, or marking `SOLD` incorrectly).
4. **Recommendation:** Keep **A** until someone inspects the live/sandbox PayPal account and names the exact API. R2 must not guess.

See also `docs/architecture/failure-modes.md` and `docs/adr/0002-paypal-webhook-reliability.md`.
