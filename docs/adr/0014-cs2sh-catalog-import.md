# ADR 0014 — cs2.sh catalog import for Product rows

## Status

Accepted

## Context

The marketplace catalog (`Product`) was a hand-written demo list. cs2.sh publishes a documented CS2 schema (`GET /v1/schema`, ~47k items keyed by `market_hash_name`) and a USD price snapshot (`GET /v1/prices/latest`). The product model is catalog metadata; `Listing` is a unique sellable item. Importing tens of thousands of listings would invent inventory nobody owns and violate the unique-item invariant.

PayPal checkout and `SellerTransaction` amounts are **BRL** (ADR 0011). cs2.sh prices are **USD**. Inventing an FX rate is not allowed.

A periodic in-process job hitting the full schema/prices snapshot is not justified: the payload is large, the provider rate-limits ~10 rps, and prices refresh on the provider side about every five minutes. Redis/SQS/workers are out of scope.

## Decision

1. **Catalog only, plus a small demo vitrine.** Upsert `Product` rows for `category = skin` and `is_tradable = true` that have `weapon`, `finish`, and `wear`. After import, upsert at most `CS2SH_DEMO_LISTING_COUNT` (default 24, max 100) `ACTIVE` listings for approved demo sellers, ranked by Steam `ask_volume` then ask. The hand-seeded demo catalog (`SEED_DEMO_DATA`) remains for CI/offline.
2. **Natural key.** `Product.marketHashName` is unique and nullable so existing demo products without a Steam name stay valid. Re-runs upsert on that key.
3. **USD is reference-only.** `Product.referencePriceUsd` stores the documented ask order: `steam.ask`, else `csfloat.ask`, else `skinport.ask`. No average, no FX. PayPal and the seller ledger stay BRL. Demo listing `price` copies the USD string with `currency: "USD"` (same as the existing seed). Checkout still sends the listing Decimal as BRL — a pre-existing mismatch, not introduced here.
4. **Operator-triggered HTTP.** `GET /v1/schema` then `GET /v1/prices/latest` complete before any database write. Bearer + `Accept-Encoding: gzip`. Timeout default 60s. GETs retry 5xx/429/timeout/network (max 3, ADR 0005). Missing `CS2SH_API_KEY` is a no-op on boot (`CS2SH_IMPORT=true`) and a non-zero CLI exit. The API process does not crash on import failure.
5. **No periodic sync job; no Render shell.** Production import is `POST /admin/catalog/cs2sh-import` (ADMIN, 202, in-process lock, 409 if already running) or boot after listen when `CS2SH_IMPORT=true`. `/ready` must not wait on cs2.sh. `npm run import:cs2sh` is local/CI only. Demo listing re-runs update price/float but never change `status`, so they cannot revive `SOLD`/`RESERVED` rows.

## Rollback

Stop setting `CS2SH_IMPORT`, do not POST the admin import route, and stop running the script. Drop the three Product columns with a new forward migration. Hand-seeded products and listings are unchanged.

## Consequences

- ~22k tradable skin `Product` rows after a full import; list endpoints already paginate.
- `referencePriceUsd` must not be read as a checkout amount.
- The API key stays in environment config and is never logged or committed.
