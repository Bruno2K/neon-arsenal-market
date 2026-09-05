# Testing

Neon Arsenal Market splits backend tests so PostgreSQL semantics are proven against a real database, while pure application logic stays fast and mockable.

PostgreSQL is required because listing reservation, order creation, idempotency, payment confirmation and seller payouts depend on transactions, unique constraints, conditional `updateMany` and lock wait — none of which SQLite or a mocked Prisma client can reproduce faithfully.

## Commands

From `server/`:

| Command | What it runs |
|---|---|
| `npm run test:unit` | Unit tests only. No PostgreSQL. |
| `npm test` | Same as `test:unit`. |
| `npm run test:integration` | PostgreSQL integration tests. Fails if the database is missing. |
| `npm run test:all` | Unit tests, then integration tests. |
| `npm run test:db:prepare` | `prisma migrate deploy` against `DATABASE_URL`. |
| `npm run perf:evidence` | Seed a disposable catalog, print `EXPLAIN ANALYZE` + `listingsService.list` timings. |

Frontend unit tests remain `npm test` at the repository root.

## Why real PostgreSQL

The flagship invariants are database-backed:

- `ACTIVE → RESERVED` is a conditional update (`status = ACTIVE`).
- Order creation, reservation and `OrderIdempotencyKey` commit in one transaction.
- `(customerId, key)` uniqueness serializes concurrent retries.
- Payment confirmation claims an order with `updateMany` and rolls back if listings cannot be sold.
- `(provider, externalEventId)` and `(sellerId, orderId)` prevent duplicate webhook/payout effects.

Unit tests with Prisma mocks still exist for validation, error mapping and control flow. They are not a substitute for the integration suite.

## Isolation

Integration tests share one migrated PostgreSQL database.

1. CI / the developer applies migrations once with `prisma migrate deploy`.
2. The integration setup pings PostgreSQL and fails closed if it is unreachable.
3. Each test starts from an empty business schema via:

```sql
TRUNCATE TABLE ... RESTART IDENTITY CASCADE
```

`TRUNCATE ... CASCADE` is used because the schema is a foreign-key graph and tests must observe committed state from concurrent connections. Rolling back a single test transaction cannot prove races. `_prisma_migrations` is never truncated.

Factories create only the rows a test needs and use random emails/keys so IDs never collide.

Integration files run serially (`fileParallelism: false`) because `TRUNCATE` empties the whole database. Unit tests keep Vitest's default file parallelism. This is isolation, not a workaround for flaky races.

Concurrency tests use `Promise.all` / `Promise.allSettled` against the same PostgreSQL instance. They do not use arbitrary sleeps. The winner is determined by a unique constraint or a conditional `UPDATE`.

## Local PostgreSQL

Do not point integration tests at the development database unless you accept a full truncate of business tables.

Recommended isolated instance:

```bash
docker compose --profile test up db-test -d
```

Then, from `server/`:

```bash
export TEST_DATABASE_URL="postgresql://neon:test@localhost:5433/neon_arsenal_test"
export DATABASE_URL="$TEST_DATABASE_URL"
npm run test:db:prepare
npm run test:integration
```

`TEST_DATABASE_URL` overrides `DATABASE_URL` for the integration suite only.

You can also create `neon_arsenal_test` on the existing `db` service and set `DATABASE_URL` to that database.

## Required variables

| Variable | Required by | Purpose |
|---|---|---|
| `DATABASE_URL` | app + integration tests | PostgreSQL connection string. Must start with `postgres`. |
| `TEST_DATABASE_URL` | integration tests (optional) | Dedicated test database. Preferred locally. |

No PayPal credentials are required for persistence tests. PayPal HTTP calls stay mocked or unused; webhook tests feed local payloads into `paymentsService.handleWebhook`.

## CI

GitHub Actions starts `postgres:16-alpine`, waits until `pg_isready` succeeds, sets `DATABASE_URL`, runs `prisma migrate deploy`, then:

```bash
npm run test:unit
npm run test:integration
```

Integration tests are not skipped when PostgreSQL is down. A missing or unreachable database fails the job.

## Current integration evidence

| Suite | Invariants |
|---|---|
| `postgres.transactions.integration.test.ts` | Commit of order + items + key + reservation; forced mid-transaction rollback; conditional `updateMany` races. |
| `postgres.constraints.integration.test.ts` | `OrderIdempotencyKey(customerId, key)`, concurrent unique inserts, per-customer key isolation, `User.email`, webhook event id, `SellerTransaction(sellerId, orderId)`. |
| `order.idempotency.integration.test.ts` | Replay, canonical listing order, conflicting key reuse, customer isolation, service-level rollback, concurrent same-key retries, reservation race. |
| `reservation.lifecycle.integration.test.ts` | Reservation timestamps, concurrent buyers, expiration vs payment, no duplicate seller transactions. |
| `paypal.webhook.integration.test.ts` | Duplicate/out-of-order events, expired capture, stale-order capture, payment rollback. PayPal remains isolated. |
| `observability.integration.test.ts` | Order/reservation/payment/webhook spans and counters against real PostgreSQL. No secrets or high-cardinality labels. |
| `performance.evidence.integration.test.ts` | `EXPLAIN ANALYZE` on market/expiry/reconciliation SQL uses the hot-path indexes; listing/order/payment timings stay bounded. |

OpenTelemetry is disabled for normal development. Telemetry tests start an in-memory exporter with `startTestTelemetry()` and do not require a collector. Unit tests also cover request-ID correlation, HTTP route cardinality, business-vs-operational span status, redaction and the disabled/OTLP-down paths. See `docs/observability.md`.

`cd server && npm run perf:evidence` reprints EXPLAIN and `listingsService.list` timings against the current database. Use a disposable catalog (the integration database), not production.
