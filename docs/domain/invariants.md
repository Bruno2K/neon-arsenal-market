# Domain invariant catalog

Canonical IDs for marketplace truths that must remain true under concurrency, retries, and process crashes.

- **Narrative contract** (lifecycle diagrams, agent checklist): [`docs/architecture/domain-invariants.md`](../architecture/domain-invariants.md)
- **Code IDs:** `server/src/shared/domain/invariants.ts`

Do not maintain a second conflicting list. When a rule changes, update this catalog, the architecture narrative, and the tests/schema that enforce it in the same change.

PostgreSQL is the source of truth. These invariants are not enforced by Redis, Kafka, SQS, or extra services.

## Required topics (#43)

| ID | Statement (short) |
|---|---|
| `INV-LISTING-EXCLUSIVE-RESERVE` | Two buyers cannot both reserve the same listing. |
| `INV-LISTING-SOLD-IRREVERSIBLE` | `SOLD` has no outgoing transition. |
| `INV-LISTING-CHECKOUT-CURRENCY` | Every sellable listing and downstream monetary snapshot is BRL. |
| `INV-ORDER-TOTAL-COMPOSITION` | `Order.totalAmount` equals the sum of item `priceSnapshot` values. |
| `INV-PAYMENT-TRUSTED-CONFIRM` | `PAID` comes from PayPal COMPLETED (webhook, capture, or GET), not a client assertion. |
| `INV-AUTH-OWNERSHIP` | Customers and sellers only act on resources they own. |
| `INV-RATE-LIMIT-CLIENT-IDENTITY` | Untrusted forwarding headers cannot choose limiter or audit identity. |
| `INV-SELLER-COMMISSION-DECIMAL` | Commission and balance use `Decimal`, not JavaScript `number`. |

Related IDs below keep this catalog aligned with the architecture narrative. Cite an existing test instead of cloning it.

---

## INV-RATE-LIMIT-CLIENT-IDENTITY

**Statement:** In a supported deployment, an untrusted HTTP client cannot choose the identity used by rate limiting or audit attribution. Render traffic trusts only one valid `CF-Connecting-IP` value when the platform-provided `RENDER=true` is present; other environments use the socket peer.

**Why it matters:** A caller-controlled forwarding chain can rotate limiter buckets, weakening protection against credential stuffing and application-level denial of service.

**Enforced:**

- HTTP edge: Express does not trust `X-Forwarded-For`; `resolveClientIp` accepts Render's overwritten header only under the Render platform signal.
- Failure behavior: a missing, malformed, or multi-valued header falls back to the socket instead of accepting attacker-selected text.
- Limiter: express-rate-limit's `ipKeyGenerator` groups IPv6 addresses by subnet.
- Tests: `server/src/shared/http/__tests__/clientIp.test.ts` and `server/src/shared/middlewares/__tests__/rateLimit.test.ts`.

**Related:** `INV-AUTH-REFRESH-FAMILY`, durable per-email login throttling.

---

## INV-LISTING-CHECKOUT-CURRENCY

**Statement:** `Listing.price`, order snapshots, PayPal amounts, and seller-ledger amounts are BRL. `Product.referencePriceUsd` is non-checkout catalog reference data and the cs2.sh import never creates listings.

**Why it matters:** A numeric USD reference labeled or captured as BRL charges a different value than the one represented to the buyer.

**Enforced:**

- Schema: `Listing.currency` defaults to `BRL`; `Listing_currency_brl_chk` rejects every other value.
- HTTP/UI: `createListingDto` accepts only `BRL` and defaults omission to `BRL`; the seller form has no currency selector and buyer-facing prices are labeled `R$`.
- Integration boundary: cs2.sh writes only `Product.referencePriceUsd` and never synthesizes sellable inventory.
- Tests: `server/src/modules/listings/__tests__/listings.currency.test.ts`, `server/src/__tests__/postgres.constraints.integration.test.ts`, and `server/src/__tests__/cs2sh.import.integration.test.ts`.

**Related:** `INV-ORDER-TOTAL-COMPOSITION`, `INV-SELLER-COMMISSION-DECIMAL`.

---

## INV-LISTING-EXCLUSIVE-RESERVE

**Statement:** A unique listing is reserved by at most one order. `ACTIVE → RESERVED` is a conditional `UPDATE … WHERE status = 'ACTIVE'` (and trade-lock is not in the future). Two concurrent buyers cannot both succeed.

**Why it matters:** Listings are unique items. A lost race would sell the same skin twice.

**Enforced:**

- Schema: `Listing.status` is `ListingStatus`. No second reservation row; the listing row is the lock.
- Service: `ordersService.create` (`updateMany` with `status: "ACTIVE"` and `reservedByOrderId`). Standalone `listingsService.reserve` uses the same `status = ACTIVE` predicate.
- Tests: `server/src/__tests__/reservation.lifecycle.integration.test.ts` (one concurrent winner); `server/src/__tests__/postgres.transactions.integration.test.ts` (`updateMany` count = 1); `server/src/modules/orders/__tests__/orders.service.test.ts`; `server/src/modules/listings/__tests__/listings.reservation.test.ts`.

**Related:** `INV-LISTING-RESERVATION-TTL`, `INV-ORDER-ATOMIC-CREATE`.

---

## INV-LISTING-SOLD-IRREVERSIBLE

**Statement:** Once a listing is `SOLD`, application paths must not return it to `ACTIVE`, `RESERVED`, or `CANCELED`. Expiration only targets `RESERVED`. Payment confirmation only sells rows that are still `RESERVED` for that order.

**Why it matters:** A sold item must not re-enter the catalog or be cancelled out from under the buyer.

**Enforced:**

- Schema: `ListingStatus` includes `SOLD`; there is no database CHECK forbidding `SOLD → ACTIVE`. Irreversibility is application + conditional updates.
- Service: `VALID_STATUS_TRANSITIONS.SOLD = []` in `listingsService.update`; `listingsService.cancel` rejects `SOLD`; `expireReservations` `WHERE status = 'RESERVED'`; `paymentsService.confirmPayment` sells only `RESERVED` + matching `reservedByOrderId`.
- Tests: `server/src/__tests__/reservation.lifecycle.integration.test.ts` (does not expire `SOLD`; payment vs expiry races); `server/src/modules/listings/__tests__/listings.reservation.test.ts`; `server/src/modules/listings/__tests__/listings.invariants.test.ts` (`SOLD` PATCH/cancel).

**Related:** `INV-LISTING-RESERVATION-TTL`.

---

## INV-ORDER-TOTAL-COMPOSITION

**Statement:** `Order.totalAmount` equals the sum of its `OrderItem.priceSnapshot` values. Each snapshot is the listing price at reservation time. A listing may appear at most once in an order.

**Why it matters:** PayPal capture amount and seller payouts are derived from this total. Floating-point addition would drift.

**Enforced:**

- Schema: `Order.totalAmount` and `OrderItem.priceSnapshot` are `Decimal`. There is no DB generated column; the service writes both in one transaction.
- Service: `ordersService.create` copies `priceSnapshot: listing.price` and writes `totalAmount` via `sumMoney` (`server/src/shared/money/policy.ts`). Duplicate listing IDs in the request are rejected before the transaction.
- Tests: `server/src/modules/orders/__tests__/orders.service.test.ts` (snapshot + multi-item Decimal sum + duplicate listing IDs); `server/src/shared/money/__tests__/policy.test.ts`; `server/src/__tests__/postgres.transactions.integration.test.ts` (committed total equals item snapshots).

**Related:** `INV-ORDER-PRICE-SNAPSHOT`, `INV-ORDER-ITEM-UNIQUE`, `INV-SELLER-COMMISSION-DECIMAL`.

---

## INV-PAYMENT-TRUSTED-CONFIRM

**Statement:** Local `Order.paymentStatus = PAID` (and the matching listing `SOLD` + seller payout) is applied only by `paymentsService.confirmPayment`, which is called from a verified PayPal webhook (`PAYMENT.CAPTURE.COMPLETED`), merchant `OrdersCapture`/`OrdersGet` when PayPal reports `COMPLETED`, or GET reconciliation of that same COMPLETED state. A client cannot set `PAID`. Hitting the PayPal return URL does not mark the order paid by itself; `POST /payments/capture` talks to PayPal first. `CHECKOUT.ORDER.APPROVED` is stored and ignored and does not sell listings.

**Why it matters:** The client is untrusted. Treating a browser callback as payment would sell listings without funds. PayPal Standard Checkout also stays `APPROVED` until the merchant captures.

**Enforced:**

- Schema: `Order.paymentStatus` is `PaymentStatus`. `PaymentWebhookEvent` unique `(provider, externalEventId)`.
- HTTP: `POST /payments/create` (authenticated customer) opens a PayPal order; `POST /payments/capture` (authenticated owner) captures an `APPROVED` order only while the local hold is live; `POST /payments/webhook` verifies PayPal headers then confirms. There is no `POST /payments/confirm`. `PATCH /orders/:id/status` accepts only fulfillment `status`; unknown `paymentStatus` on that body is stripped. CUSTOMER cannot `PENDING → CONFIRMED`.
- Service: `confirmPayment` claims `paymentStatus = PENDING AND status = PENDING`. Duplicate claims are no-ops. Expired/mismatched reservations roll back the claim (HTTP 409). Capture is skipped when the hold is dead so funds are not taken after expiry. The same transaction inserts `PAYMENT_CONFIRMED` and `ORDER_CONFIRMED` outbox rows (ADR 0012).
- Tests: `server/src/__tests__/paypal.webhook.integration.test.ts`; `server/src/modules/payments/__tests__/payments.controller.test.ts` (signature required); `server/src/modules/payments/__tests__/payments.service.test.ts`; `server/src/__tests__/order.status.integration.test.ts` (CUSTOMER cannot skip payment; cancel leaves `paymentStatus` PENDING); `server/src/shared/types/__tests__/roles.test.ts` (status DTO strips `paymentStatus`); `server/src/__tests__/outbox.integration.test.ts`.

**Related:** `INV-PAYMENT-WEBHOOK-AUTHENTIC`, `INV-PAYMENT-WEBHOOK-IDEMPOTENT`, `INV-PAYMENT-LINK-IDEMPOTENT`.

---

## INV-AUTH-OWNERSHIP

**Statement:** A CUSTOMER may read/mutate only their own orders and customer-scoped data. A SELLER may read order/tracking data only when they own an item in the order, and may mutate only their own listings. ADMIN may cross those boundaries where the route allows. Authentication/authorization are not bypassed for tests.

**Why it matters:** IDOR on orders or listings leaks buyer/seller data and would let a stranger cancel or reprice someone else's inventory.

**Enforced:**

- Schema: `Order.customerId`, `Listing.sellerId`, `OrderItem.sellerId`.
- Service: `ordersService.getById` / `updateStatus` / `updateTracking`; `paymentsService.createPaymentLink` (`order.customerId !== userId` → 403); `listingsService.update` / `updatePrice` / `cancel`; `commissionsService.listTransactions` is seller-scoped unless ADMIN.
- Tests: `server/src/modules/orders/__tests__/orders.service.test.ts`; `server/src/modules/listings/__tests__/listings.invariants.test.ts`; `server/src/modules/payments/__tests__/payments.service.test.ts` (createPaymentLink 403); `server/src/modules/commissions/__tests__/commissions.service.test.ts`; `server/src/__tests__/audit.integration.test.ts` (audit log ADMIN-only).

**Related:** `INV-AUDIT-APPEND-ONLY`, `INV-AUTH-REFRESH-FAMILY`.

---

## INV-AUTH-REFRESH-FAMILY

**Statement:** A refresh JWT is accepted only when its `jti` row exists, is unexpired, unused, and unrevoked. Rotation is a conditional `UPDATE` that sets `usedAt`. Reuse of a used/revoked `jti` revokes every token in that `familyId`. Logout revokes the family. Login and email verification start a new family.

**Why it matters:** A denylist of rotated `jti`s leaves the current family token valid after theft/replay. Family revocation ends the stolen session.

**Enforced:**

- Schema: `RefreshToken` (`jti` unique, `familyId`, `usedAt`, `revokedAt`, `expiresAt`). No raw JWT stored.
- Service: `authService.refresh` / `logout` / login session issue (`server/src/modules/auth/auth.service.ts`). ADR 0015.
- Tests: `server/src/modules/auth/__tests__/auth.service.test.ts`; `server/src/__tests__/auth.security.integration.test.ts`.

**Related:** `INV-AUTH-OWNERSHIP`.

---

## INV-SELLER-COMMISSION-DECIMAL

**Statement:** For a confirmed payment, `net = gross − commission` where `commission = gross × seller.commissionRate`. Arithmetic uses Prisma/`Decimal.js`, not JavaScript `number`. Seller transaction create and `Seller.balance` increment happen in the same payment transaction. `(sellerId, orderId)` is unique so retries cannot double-pay.

**Why it matters:** IEEE-754 (`0.1 + 0.2`) is not a ledger. Duplicate confirmations must not increment balance twice.

**Enforced:**

- Schema: `Seller.commissionRate`, `Seller.balance`, `SellerTransaction.grossAmount` / `commissionAmount` / `netAmount` are `Decimal`. `@@unique([sellerId, orderId])`. CHECK `netAmount = grossAmount - commissionAmount`.
- Service: `aggregateGrossBySeller` + `computeSellerLedgerAmounts` then `paymentsService.confirmPayment` writes the row and `balance: { increment: netAmount }` inside the claim transaction. Currency, scale, and rounding mode are `server/src/shared/money/policy.ts`.
- Tests: `server/src/shared/money/__tests__/policy.test.ts`; `server/src/shared/money/__tests__/sellerLedger.test.ts`; `server/src/modules/payments/__tests__/payments.service.test.ts`; `server/src/__tests__/seller.ledger.integration.test.ts`; `server/src/__tests__/postgres.constraints.integration.test.ts`.

**Related:** `INV-SELLER-TXN-UNIQUE`, `INV-SELLER-LEDGER-SOURCE`, `INV-PAYMENT-TRUSTED-CONFIRM`.

---

## INV-SELLER-LEDGER-SOURCE

**Statement:** `SellerTransaction` is the authoritative seller ledger. `Seller.balance` is a materialized projection of PAID `netAmount` rows for that seller. Confirmation inserts the ledger row and increments the projection in one PostgreSQL transaction. If they disagree, the ledger wins. Amounts are BRL. Confirmation writes `PaymentStatus.PAID`. There is no refund path.

**Why it matters:** A cached balance that can drift from history is not a financial source of truth. Webhook retries must not mint a second payout.

**Enforced:**

- Schema: unique `(sellerId, orderId)`; CHECK net identity and non-negative amounts. `Seller.balance` documented as projection (ADR 0011).
- Service: `confirmPayment` claim (`paymentStatus = PENDING AND status = PENDING`) plus ledger insert. Duplicate claims are no-ops. `commissionsService.reconcileSellerLedger` SETs a drifted `Seller.balance` to PAID `SUM(netAmount)` under `FOR UPDATE`; it does not insert or delete ledger rows.
- HTTP: `GET /commissions/balance` returns the Prisma Decimal projection (JSON string via Decimal#toJSON). No `Number()`.
- Seed: demo `Seller.balance` is `"0.00"` with no ledger rows so the projection matches empty PAID SUM. Re-seed writes that catalog zero only when the seller has no PAID ledger rows; if PAID rows exist, seed sets the projection to `SUM(netAmount)` and does not wipe credited net. Confirm remains the only production non-zero writer of ledger rows.
- Job: in-process interval (60s) started with the PayPal/reservation jobs. Second run is a no-op when aligned. Concurrent confirm vs reconcile cannot double-credit because the corrective write holds the seller row and assigns SUM rather than incrementing.
- Tests: `seller.ledger.integration.test.ts` (sequential and concurrent confirm, net identity, Decimal vs float); `seller.ledger.reconcile.integration.test.ts`; `commissions.reconcile.test.ts`; `reservation.lifecycle.integration.test.ts`; `paypal.webhook.integration.test.ts`; `commissions.service.test.ts`; `demoCatalog.test.ts`; `seed.ledger.integration.test.ts`.

**Related:** `INV-SELLER-COMMISSION-DECIMAL`, `INV-SELLER-TXN-UNIQUE`. Periodic projection vs PAID SUM reconciliation is implemented (issue #45); see ADR 0011.

---

## Related invariants (do not fork)

These are already specified in the architecture narrative. This table is the ID map only.

| ID | Statement (short) | Primary enforcement | Primary tests |
|---|---|---|---|
| `INV-LISTING-RESERVATION-TTL` | `RESERVED` persists `reservedAt`, `reservationExpiresAt`, `reservedByOrderId`. Release only expired `RESERVED` rows and clears the hold. Payment requires unexpired hold for this order. | `ordersService.create`, `listingsService.expireReservations`, `paymentsService.confirmPayment` | `reservation.lifecycle.integration.test.ts`, `paypal.webhook.integration.test.ts` |
| `INV-ORDER-ITEM-UNIQUE` | Each listing appears at most once in a create request. | `ordersService.create` Set check | `orders.service.test.ts` |
| `INV-ORDER-PRICE-SNAPSHOT` | Item price is copied at reservation, not read later from the listing. | `ordersService.create` `priceSnapshot` | `orders.service.test.ts` |
| `INV-ORDER-ATOMIC-CREATE` | Idempotency key, order, items, and reservation commit together or not at all. | `prisma.$transaction` in `ordersService.create` | `postgres.transactions.integration.test.ts` |
| `INV-ORDER-IDEMPOTENCY` | Customer-scoped `Idempotency-Key`; same hash replays; different hash 409. | `OrderIdempotencyKey` unique `(customerId, key)` | `order.idempotency.integration.test.ts` |
| `INV-ORDER-STATUS-MACHINE` | Explicit fulfillment graph; atomic `UPDATE … WHERE status = $from`; SELLER cannot PATCH status. Cancelling `CONFIRMED` does not invent a PayPal refund. | `order-status.ts`, `ordersService.updateStatus` | `order-status.test.ts`, `order.status.integration.test.ts` |
| `INV-PAYMENT-WEBHOOK-AUTHENTIC` | Required PayPal headers; transmission time within 5 minutes; reject before `handleWebhook`. | `paymentsController.webhook`, `verifyPayPalWebhookSignature` | `payments.controller.test.ts`, `paypalWebhook` unit tests |
| `INV-PAYMENT-WEBHOOK-IDEMPOTENT` | Duplicate event id is a no-op; duplicate confirm does not double payout. | `PaymentWebhookEvent` unique `(provider, externalEventId)`; `confirmPayment` claim | `paypal.webhook.integration.test.ts`, `postgres.constraints.integration.test.ts` |
| `INV-PAYMENT-LINK-IDEMPOTENT` | One `OrdersCreate` per local order. Replay completed `PaymentLink`. Concurrent claim 409. OrdersCreate is not retried. | `PaymentLink.orderId` PK | `payment.link.idempotency.integration.test.ts` |
| `INV-SELLER-TXN-UNIQUE` | One seller transaction per `(sellerId, orderId)`. | schema unique + confirm claim | `postgres.constraints.integration.test.ts`, `seller.ledger.integration.test.ts` |
| `INV-AUDIT-APPEND-ONLY` | Sensitive mutations append `AuditLog`; ADMIN-only read; 365-day retention; no secrets on the trail. | `auditRepository`, `GET /admin/audit-logs` | `audit.integration.test.ts`, `docs/adr/0010-audit-log.md` |
| `INV-AUTH-REFRESH-FAMILY` | Refresh `jti` allowlist; reuse of a used token revokes the family. | `RefreshToken`, `authService.refresh` | `auth.security.integration.test.ts`, `docs/adr/0015-refresh-token-families.md` |
| `INV-DB-ENUMS` | Lifecycle columns are PostgreSQL enums; invalid labels fail with `22P02`. | Prisma enums | `postgres.enums.integration.test.ts`, `roles.test.ts` |

Transactional outbox (#46) is implemented: `OutboxEvent` in the confirm transaction, in-process skip-locked dispatcher, no SQS. See `docs/adr/0012-transactional-outbox.md`.

## Changing an invariant

1. Update this catalog and `docs/architecture/domain-invariants.md`.
2. Update Prisma schema/migration if the database model changes.
3. Add or extend the regression/integration test named in the row.
4. Write an ADR when the change is significant.

Periodic financial reconciliation as a product (#45) is implemented: in-process job, ledger-wins SET of `Seller.balance`, audit + metrics. See `docs/adr/0011-seller-ledger.md`.

Randomized property coverage for money composition, commission identity, SOLD irreversibility, and idempotent request hashes lives in `server/src/shared/domain/__tests__/invariants.property.test.ts` (seed `0x4e454f4e`, #64).
