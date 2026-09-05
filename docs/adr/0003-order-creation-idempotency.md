# ADR 0003 — Order creation idempotency

## Status

Accepted.

## Context

Creating an order reserves unique listings. If a client retries after a timeout or connection loss, the system must not create a second order or reserve another listing for the same business request. The retry contract also has to work across multiple API instances and after process restarts.

## Decision

`POST /orders` requires an `Idempotency-Key` header. Keys are scoped to the authenticated customer and stored in PostgreSQL in `OrderIdempotencyKey`.

The idempotency row contains a canonical SHA-256 request hash based on the sorted listing IDs. Creation of that row, listing reservation, order creation, order items, and the final idempotency link to the order all happen in one PostgreSQL transaction.

The unique `(customerId, key)` constraint serializes concurrent retries. If a retry uses the same key and request hash after the first transaction commits, the API returns the original order. If the same key is reused for a different listing set, the API returns 409.

## Consequences

- A crash before transaction commit leaves no order, reservation, or idempotency row.
- A crash after transaction commit but before the response is delivered can be retried safely; the committed idempotency row points to the original order.
- Failed validation or failed reservation attempts roll back the idempotency row, because no durable business effect was created.
- The key is not global; two different customers may use the same client-generated key without observing each other's requests.

## Alternatives rejected

- In-memory idempotency cache: not durable and not multi-instance safe.
- Redis/set-based key store: unnecessary infrastructure for a correctness invariant PostgreSQL can enforce in the existing transaction boundary.
- Hashing the raw request body: too sensitive to field order and JSON formatting; the current order request semantics are the set of listing IDs.
