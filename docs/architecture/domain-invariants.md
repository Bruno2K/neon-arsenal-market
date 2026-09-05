# Domain Invariants

This document is the contract that agents must preserve when modifying business logic.

## Listings

A listing represents a unique marketplace item.

Allowed lifecycle:

```text
ACTIVE → RESERVED → SOLD
       ↘ CANCELED
```

Rules:

1. A listing must not be sold twice.
2. Two concurrent buyers must not both successfully reserve the same listing.
3. Reservation expiration must not accidentally reactivate a listing that has already been sold.
4. Payment confirmation must only finalize a listing that belongs to the corresponding order and is in the expected state.
5. A client must never be able to force a listing state transition by supplying an arbitrary status.
6. Becoming `RESERVED` must persist `reservedAt` and `reservationExpiresAt`.
7. `RESERVED → ACTIVE` is allowed only for rows that are still `RESERVED` and whose `reservationExpiresAt` is in the past (or null, treated as invalid/expired).
8. Payment confirmation must not mark a listing `SOLD` unless it is still `RESERVED` and `reservationExpiresAt` is in the future. If that condition fails, the payment claim must roll back.

## Orders

1. An order belongs to one customer.
2. Each listing may appear at most once in an order.
3. Order item price is a snapshot of the price at purchase/reservation time.
4. Order total must equal the sum of its item price snapshots.
5. Order creation and reservation must have an atomic consistency boundary.
6. Repeated order-creation requests must not create duplicate business effects when idempotency is required.

## Payments

1. A payment confirmation is idempotent.
2. Duplicate webhook delivery must not create duplicate seller transactions or duplicate balance increments.
3. Webhook authenticity must be verified before trusting an event.
4. Payment state comes from the trusted payment integration, not from a client assertion.
5. Local payment processing must tolerate duplicate, delayed, out-of-order and retried provider events.
6. A crash must not permanently leave the system unable to reconcile external payment state with local state.

## Seller finances

For a confirmed payment:

```text
gross amount
    - commission
    = net amount
```

Rules:

1. Commission uses the applicable seller commission rate.
2. Seller transaction creation and seller balance update must be consistent.
3. The same order/seller pair must not generate duplicate seller transactions.
4. Monetary calculations must preserve exact decimal semantics.

## Authorization

1. Customers can access only their own orders and customer-scoped data.
2. Sellers can access order information only when they own an item in the order.
3. Administrative operations require the appropriate role.
4. Authentication and authorization cannot be bypassed for testing convenience.

## Database integrity

Database constraints are part of the business model. Agents must prefer constraints, conditional updates and transactions over assumptions in application code.

When changing an invariant, the agent must:

1. update this document;
2. update the Prisma schema/migration if the database model changes;
3. add regression/integration tests;
4. document the architectural decision when the change is significant.

## Concurrency checklist

For any change involving orders, listings, reservations, payments or seller balances, answer:

- What happens with two concurrent requests?
- Which operation wins?
- What database condition makes the transition atomic?
- What happens if the process crashes after step N?
- Can a retry duplicate a side effect?
- Can an expiration race a payment confirmation?
- Can an external event arrive before the local transaction completes?
