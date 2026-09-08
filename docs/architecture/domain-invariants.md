# Domain Invariants

This document is the **narrative contract** that agents must preserve when modifying business logic.

The **canonical ID catalog** (statement, why it matters, schema / service / test map) is [`docs/domain/invariants.md`](../domain/invariants.md). Stable IDs also live in `server/src/shared/domain/invariants.ts`.

Do not maintain a second conflicting list. When a rule changes, update the catalog and this narrative in the same change.

## Listings

IDs: `INV-LISTING-EXCLUSIVE-RESERVE`, `INV-LISTING-SOLD-IRREVERSIBLE`, `INV-LISTING-RESERVATION-TTL`, `INV-LISTING-CHECKOUT-CURRENCY`.

A listing represents a unique marketplace item.

Allowed lifecycle:

```text
ACTIVE → RESERVED → SOLD
             ↓
           ACTIVE
       ↘ CANCELED
```

Rules:

1. A listing must not be sold twice.
2. Two concurrent buyers must not both successfully reserve the same listing.
3. Reservation expiration must not accidentally reactivate a listing that has already been sold.
4. Payment confirmation must only finalize a listing that belongs to the corresponding order and is in the expected state.
5. A client must never be able to force a listing state transition by supplying an arbitrary status.
6. Becoming `RESERVED` must persist `reservedAt`, `reservationExpiresAt` and, for checkout, `reservedByOrderId`.
7. `RESERVED → ACTIVE` is allowed only for rows that are still `RESERVED` and whose `reservationExpiresAt` is in the past (or null, treated as invalid/expired). That release must also clear `reservedByOrderId`.
8. Payment confirmation must not mark a listing `SOLD` unless it is still `RESERVED`, `reservedByOrderId` matches the paying order, and `reservationExpiresAt` is in the future. If that condition fails, the payment claim must roll back.
9. A stale capture for an earlier order must not sell a listing that later returned to `ACTIVE` and was reserved by another order.
10. Every sellable listing, order snapshot, PayPal amount, and ledger amount is BRL. USD from cs2.sh is product reference data only and must not create inventory or enter checkout without an explicit future FX decision.

## Orders

IDs: `INV-ORDER-TOTAL-COMPOSITION`, `INV-ORDER-ITEM-UNIQUE`, `INV-ORDER-PRICE-SNAPSHOT`, `INV-ORDER-ATOMIC-CREATE`, `INV-ORDER-IDEMPOTENCY`, `INV-ORDER-STATUS-MACHINE`.

Allowed fulfillment lifecycle:

```text
PENDING → CONFIRMED → SHIPPED → DELIVERED
       ↘ CANCELLED ↙
```

1. An order belongs to one customer.
2. Each listing may appear at most once in an order.
3. Order item price is a snapshot of the price at purchase/reservation time.
4. Order total must equal the sum of its item price snapshots.
5. Order creation and reservation must have an atomic consistency boundary.
6. `POST /orders` requires a customer-scoped `Idempotency-Key`; repeated requests with the same key and canonical listing set must return the original order without creating another order or reservation.
7. Reusing the same `Idempotency-Key` for a different canonical listing set must be rejected deterministically.
8. The idempotency record must commit in the same transaction as order creation and reservation so crash-before-commit leaves no business effect and crash-after-commit can be retried safely.
9. `Order.status` follows an explicit state machine. Allowed transitions: `PENDING → CONFIRMED | CANCELLED`, `CONFIRMED → SHIPPED | CANCELLED`, `SHIPPED → DELIVERED`. `DELIVERED` and `CANCELLED` are terminal.
10. A client must never force an arbitrary order status. `PATCH /orders/:id/status` applies only a valid transition, atomically (`UPDATE … WHERE id = $id AND status = $from`). A concurrent winner leaves the loser with HTTP 409 and exactly one committed successor.
11. Role rules for `PATCH /orders/:id/status`: SELLER cannot change fulfillment status. CUSTOMER may cancel their own `PENDING` or `CONFIRMED` order and may mark their own `SHIPPED` order `DELIVERED`. ADMIN may apply any graph edge. `PENDING → CONFIRMED` for payment remains the trusted payment-confirmation path, not a customer PATCH. Cancelling a `CONFIRMED` order does not invent a PayPal refund; `paymentStatus` is unchanged.

## Payments

IDs: `INV-PAYMENT-TRUSTED-CONFIRM`, `INV-PAYMENT-WEBHOOK-AUTHENTIC`, `INV-PAYMENT-WEBHOOK-IDEMPOTENT`, `INV-PAYMENT-LINK-IDEMPOTENT`.

1. A payment confirmation is idempotent.
2. Duplicate webhook delivery must not create duplicate seller transactions or duplicate balance increments.
3. Webhook authenticity must be verified before trusting an event. Required PayPal headers: `paypal-transmission-id`, `paypal-transmission-time`, `paypal-transmission-sig`, `paypal-cert-url`, `paypal-auth-algo`. `paypal-transmission-time` must be a valid RFC 3339 timestamp within 5 minutes of the server clock (absolute skew).
4. Payment state comes from the trusted payment integration, not from a client assertion.
5. Local payment processing must tolerate duplicate, delayed, out-of-order and retried provider events.
6. A crash must not permanently leave the system unable to reconcile external payment state with local state.
7. Each PayPal webhook event id is persisted (`PaymentWebhookEvent`) with a unique constraint on `(provider, externalEventId)`.
8. Webhook path: only `PAYMENT.CAPTURE.COMPLETED` confirms local payment. `CHECKOUT.ORDER.APPROVED` is intermediate and must not sell listings or create seller transactions. Merchant `OrdersCapture` / `OrdersGet` may call `confirmPayment` only when PayPal reports `COMPLETED`.
9. External PayPal calls have an explicit timeout. Creating or capturing a PayPal order is not retried. Looking up PayPal order status, fetching an OAuth token, or downloading a webhook certificate may retry HTTP 5xx/429, timeouts and network errors (max 3 attempts, exponential backoff).
10. `POST /payments` (create payment link) is idempotent per local order. A durable `PaymentLink` row claims the order before `OrdersCreate`. A retry that finds `paypalOrderId` or a completed `PaymentLink` must return the original PayPal order without calling `OrdersCreate` again. Concurrent identical requests have one `OrdersCreate`. An in-progress claim returns HTTP 409.
11. Optional `returnUrl` and `cancelUrl` on `POST /payments/create` are forwarded to PayPal `OrdersCreate` as `application_context.return_url` / `cancel_url` when present, and omitted when absent. The server does not invent defaults or env-based URLs. Buyer return/cancel at PayPal does not set `PAID` by itself. `POST /payments/capture` (order owner) captures an `APPROVED` PayPal order only while the local hold is live, then `confirmPayment` runs if PayPal reports `COMPLETED`.
12. `confirmPayment` inserts `PAYMENT_CONFIRMED` and `ORDER_CONFIRMED` outbox rows in the same local transaction as the domain write. Duplicate confirm does not insert again. An in-process dispatcher claims with `FOR UPDATE SKIP LOCKED`. The first handler is log + metric only and must not confirm payment again (`docs/adr/0012-transactional-outbox.md`).

## Seller finances

IDs: `INV-SELLER-COMMISSION-DECIMAL`, `INV-SELLER-TXN-UNIQUE`, `INV-SELLER-LEDGER-SOURCE`.

For a confirmed payment:

```text
gross amount
    - commission
    = net amount
```

Rules:

1. Commission uses the applicable seller commission rate. Arithmetic is Prisma `Decimal`, never JavaScript `number`.
2. `SellerTransaction` is the authoritative ledger. One row per `(sellerId, orderId)`. Currency is BRL (PayPal capture). Listing prices and PayPal amounts use 2 decimal places; commission is exact `gross × rate` with no extra rounding step. Shared helpers live in `server/src/shared/money/`. See `docs/architecture/money-policy.md` and `docs/adr/0011-seller-ledger.md`.
3. Confirmation writes `status = PAID`. `REFUNDED` is not an application path.
4. `Seller.balance` is a materialized projection of PAID net amounts, updated in the same local database transaction as the ledger insert. If they disagree, the ledger wins. An in-process job SETs a drifted projection to PAID `SUM(netAmount)` (no ledger-row rewrite) and records `SELLER_BALANCE_RECONCILED`.
5. Duplicate confirm, webhook replay, and concurrent confirmation must not insert a second row or double-credit the projection.
6. `GET /commissions/balance` exposes that projection as Prisma Decimal JSON (string), not a JavaScript `number`. Demo seed writes `"0.00"` with no ledger rows so display data cannot diverge from an empty SUM. Re-seed zeros a stale catalog projection only when that seller has no PAID rows; existing PAID net is aligned to `SUM(netAmount)`, not wiped.

## Authorization

IDs: `INV-AUTH-OWNERSHIP`, `INV-AUTH-REFRESH-FAMILY`, `INV-AUDIT-APPEND-ONLY`.

1. Customers can access only their own orders and customer-scoped data.
2. Sellers can access order information only when they own an item in the order.
3. Administrative operations require the appropriate role.
4. Authentication and authorization cannot be bypassed for testing convenience.
5. Sensitive mutations persist an append-only `AuditLog` row (actor, action, resource, non-sensitive before/after, timestamp, optional IP/user-agent). Read access is ADMIN-only (`GET /admin/audit-logs`). Retention is 365 days; see `docs/adr/0010-audit-log.md`. Credentials, JWT/refresh tokens, passwords, PayPal secrets, and full payment payloads must not be stored on the trail.
6. Refresh tokens are an allowlist (`RefreshToken`) grouped by `familyId`. Each login starts a family. Rotation claims the current `jti` (`usedAt` null) and inserts a successor in the same family. Presenting a used or revoked `jti` revokes the entire family (`INV-AUTH-REFRESH-FAMILY`). Logout revokes the family. Access tokens still expire on TTL and are not denylisted.
7. Failed login attempts for a normalized email persist a progressive delay (`LoginThrottle`). After two free failures the next attempt is blocked until `nextAllowedAt` (1s, 2s, 4s, … cap 15 minutes) with HTTP 429 and `Retry-After`. The handler does not sleep. Unknown emails are throttled too. Registration passwords must be 8–72 characters with a letter and a number.

## Database integrity

ID: `INV-DB-ENUMS`.

Database constraints are part of the business model. Agents must prefer constraints, conditional updates and transactions over assumptions in application code.

Critical lifecycle fields are PostgreSQL/Prisma enums so invalid labels cannot be persisted:

- `UserRole` — `User.role`, `PendingRegistration.role` (`ADMIN`, `SELLER`, `CUSTOMER`)
- `OrderStatus` — `Order.status` (`PENDING`, `CONFIRMED`, `SHIPPED`, `DELIVERED`, `CANCELLED`)
- `PaymentStatus` — `Order.paymentStatus`, `SellerTransaction.status` (`PENDING`, `PAID`, `REFUNDED`)
- `ListingStatus` — `Listing.status` (`ACTIVE`, `SOLD`, `RESERVED`, `CANCELED`)
- `ClaimStatus` — `PaymentLink.status`, `OrderIdempotencyKey.status` (`IN_PROGRESS`, `COMPLETED`)
- `WebhookEventStatus` / `PaymentProvider` — `PaymentWebhookEvent.status` and `.provider`
- `OutboxEventStatus` — `OutboxEvent.status` (`PENDING`, `PROCESSING`, `PUBLISHED`, `FAILED`)

`PaymentWebhookEvent.eventType` remains text so unknown PayPal events can still be claimed and marked `IGNORED`. Catalog fields (game, rarity, exterior, currency) are not enums.

When changing an invariant, the agent must:

1. update this document **and** `docs/domain/invariants.md`;
2. update the Prisma schema/migration if the database model changes;
3. add regression/integration tests;
4. document the architectural decision when the change is significant.

## Integration evidence

The PostgreSQL integration suite in `server/src/__tests__/*.integration.test.ts` is the evidence that the invariants above hold under concurrency and rollback. Those tests must query committed database state. They must not be skipped when PostgreSQL is unavailable.

## Concurrency checklist

For any change involving orders, listings, reservations, payments or seller balances, answer:

- What happens with two concurrent requests?
- Which operation wins?
- What database condition makes the transition atomic?
- What happens if the process crashes after step N?
- Can a retry duplicate a side effect?
- Can an expiration race a payment confirmation?
- Can an external event arrive before the local transaction completes?
