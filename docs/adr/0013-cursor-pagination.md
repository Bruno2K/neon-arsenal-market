# ADR 0013 — Dual-mode listing pagination (offset + keyset cursor)

## Status

Accepted

## Context

Issue #49. `GET /listings` is the highest-volume list. Offset pagination (`page`/`limit`) is what the Market client uses (`items`, `total`, `page`, `limit`). Deep `OFFSET` and `COUNT(*)` are the documented scaling costs (ADR 0006, `docs/performance.md`).

Replacing offset with cursor-only would break the current frontend. Redis is not an option. Admin audit and price history stay on page/limit.

## Decision

1. **Dual contract.** Omit `cursor` → offset mode `{ items, total, page, limit, nextCursor }`. `page` default 1, `limit` default 20, max 100 (unchanged). Presence of `cursor` (empty string = first keyset page) ignores `page` and returns `{ items, limit, nextCursor }` with no `total`.
2. **Stable keyset.** Order is `createdAt DESC, id DESC`. The cursor is opaque base64url of those two keys. Invalid cursors are HTTP 400 (`Invalid cursor`) without echoing the payload.
3. **Indexes.** `Listing(createdAt, id)`, `Listing(status, createdAt, id)` replacing `Listing(status, createdAt)`, and `Product(createdAt, id)`. Left-prefix of `(status, createdAt, id)` still serves status-only filters.
4. **Concurrency.** A row inserted after a keyset page was fetched does not appear on the next cursor page and does not duplicate or skip rows already walked. Offset mode can still duplicate/skip under inserts; that is why cursor exists.
5. **Same optional contract on `GET /products`.** Admin audit remains offset-only.

## Rollback

Clients that omit `cursor` keep the previous offset JSON (`total`/`page`/`limit`). Drop the new indexes and ignore `cursor` to revert keyset mode. Do not rewrite old migrations.

## Consequences

- Market continues to send `page`/`limit` and ignores extra `nextCursor`.
- Cursor mode skips `COUNT(*)`.
- Clients must treat the cursor as opaque. Encoding may change if the sort keys change; that would be a new ADR.
