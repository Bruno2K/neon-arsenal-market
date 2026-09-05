# ADR 0009 — Prisma/PostgreSQL enums for critical domain states

## Status

Accepted

## Context

Issue #41. Role, order fulfillment, payment, listing, webhook processing, payment-link claim, and order-idempotency claim fields were `TEXT` with comments listing allowed values. TypeScript unions and Zod tuples duplicated those labels, but PostgreSQL accepted any string. A bug, raw query, or missed validation could persist `CANCELLED` on a listing (the listing machine uses `CANCELED`) or an invented payment status.

PostgreSQL is the source of truth for transactional state. The database must participate in the same invariants as the application.

## Decision

1. Model the closed domain sets as Prisma enums, which become native PostgreSQL enums:
   - `UserRole` — `User.role`, `PendingRegistration.role`
   - `OrderStatus` — `Order.status` (`CANCELLED`, British spelling, unchanged)
   - `PaymentStatus` — `Order.paymentStatus` and `SellerTransaction.status`
   - `ListingStatus` — `Listing.status` (`CANCELED`, American spelling, unchanged)
   - `ClaimStatus` — `PaymentLink.status`, `OrderIdempotencyKey.status`
   - `WebhookEventStatus` — `PaymentWebhookEvent.status`
   - `PaymentProvider` — `PaymentWebhookEvent.provider`
2. Migration is additive-safe: existing TEXT values are cast with `USING (col::Enum)`. Before the cast, a `DO` block counts rows whose values are not in the documented set and `RAISE EXCEPTION` with a HUMAN stop. No invented mapping.
3. Keep `PaymentWebhookEvent.eventType` as `TEXT`. Unknown PayPal event types must still be claimed and marked `IGNORED`. An enum would reject new provider events at insert and break webhook idempotency.
4. Do not enum catalog fields (`Product.game`, rarity, exterior, `Listing.currency`). Those are not state machines and grow independently of fulfillment.
5. Application Zod tuples are derived from the generated Prisma enums so HTTP validation and the database share one label set.

## Rollback

PostgreSQL enum **value** removal is hard. Rollback of this change is a column revert, not a value delete:

```sql
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
-- repeat for each converted column, then DROP TYPE ...
```

Forward-only enum **additions** (new statuses) are cheap. Shrinking a set later is not; treat new labels as a product decision.

## Consequences

- Invalid writes fail at Prisma validation or PostgreSQL (`invalid input value for enum`), not only in TypeScript.
- Indexes on enum columns remain valid; btree comparison uses enum order (declaration order), which matches previous TEXT only for equality filters used today.
- Admin/order list query filters must validate enum labels before querying, or Prisma rejects them at runtime.
