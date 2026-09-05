# ADR 0003 — Order creation idempotency

## Status

Accepted

## Context

`POST /orders` reserves unique listings. A lost HTTP response after commit makes the client retry. Without a durable key, the retry is a second create: it either fails because the listing is already `RESERVED` or, after expiration, could create another order. Concurrent identical requests must also produce one business effect across application instances. Redis and distributed locks are not justified.

## Decision

1. Require header `Idempotency-Key` (8–128 chars `[A-Za-z0-9._:-]`), scoped to the authenticated user.
2. Persist `OrderIdempotency` with unique `(userId, key)`.
3. Fingerprint = SHA-256 of canonical `{ listingIds: sorted listing IDs }` after Zod parse. Array/property order must not false-mismatch a retry. Extra body fields never reach the fingerprint because Zod strips them.
4. In **one PostgreSQL transaction**: insert `PROCESSING` (claims the key), create the order and reserve listings, update the row to `COMPLETED` with `orderId`. Commit makes only `COMPLETED` visible. A crash or thrown `AppError` rolls back the claim, so the next retry is a first request.
5. Concurrent identical requests: the second `INSERT` waits on the unique index, then either sees `COMPLETED` and replays (`P2002` → load order) or proceeds after the first rolled back. `PROCESSING` is not committed; HTTP 409 "already in progress" is only a defensive response if a `PROCESSING` row is ever visible.
6. Same user + same key + different fingerprint → **409 Conflict**. Do not overwrite.
7. Same key for different users is independent.
8. Replay loads the live order by `orderId` (same shape as create). HTTP 201 for both first success and replay. Do not persist the JSON body or payment secrets.
9. Retention: records are valid for **7 days** for legitimate retries. No sweeper in this change; `createdAt` is indexed so a later job can delete expired rows without blocking in-window retries.

Rejected: in-memory Map; Redis; claiming the key after reservation (identical retries would race listings and one would get 400); storing a frozen response snapshot.

## Consequences

- Two concurrent identical `POST /orders` cannot create two orders: uniqueness serializes the claim before reservation.
- A committed success with a lost HTTP response replays the same order.
- A failed reservation does not leave a successful idempotency row.
- Cleanup is operational follow-up, not required for correctness inside the 7-day window.
