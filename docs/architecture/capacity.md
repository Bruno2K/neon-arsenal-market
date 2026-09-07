# Capacity hypotheses and scale model

Issue #74. These are **hypotheses** for a portfolio/demo marketplace on Render, tied to measurements that already exist. They are **not** k6 results. Issue #55 (load testing) is not done; do not invent RPS, p95-under-load, or error-rate numbers.

Evidence that **is** in-repo:

- `docs/performance.md` — `EXPLAIN ANALYZE` + `listingsService.list` timings at 2 500 `ACTIVE` listings (`cd server && npm run perf:evidence`)
- `docs/architecture/scaling-path.md` — measured triggers; explicit non-goals (Redis/Kafka/SQS)
- `docs/adr/0006-hot-path-indexes.md` — why those indexes exist
- `render.yaml` — one Docker API + one managed PostgreSQL (ADR 0007)

## Hypotheses (planning, not SLOs)

| Dimension | Hypothesis | What we actually measured |
|---|---|---|
| Users | Single-operator demo: tens of concurrent browsers, not a claimed MAU | None. No analytics-backed user count in this repo. |
| RPS | Browse-dominated. Checkout and webhooks are rare relative to `GET /listings`. A single Render instance is assumed enough until a **measured** listing p95 or CPU trigger fires | No k6. Listing list p95 **~4 ms** on the evidence VM at 2.5k rows — that is query time, not offered load |
| Read / write mix | ~browse/PDP reads vs reserve/payment writes. Writes are PK/conditional updates, not scans | Hot-path table in `docs/performance.md`. Write cost is the listing row lock, not a sequential scan |
| Catalog size | Comfortable at a few thousand `ACTIVE` listings (current evidence set). Re-run `perf:evidence` after ~10× growth | 2 500 `ACTIVE` + 80 `RESERVED` + 80 `SOLD` in the evidence fixture |
| Checkout concurrency | Unique listings: N buyers on the **same** listing → one `ACTIVE → RESERVED` winner. Buyers on **different** listings contend on different rows | Integration tests for concurrent reserve; not a load-test RPS |
| PostgreSQL connections | Prisma default pool is roughly `num_physical_cpus * 2 + 1` per API process (no `connection_limit` in `DATABASE_URL` today; do not add an env var here). Render current-gen Postgres **under 8 GB RAM** typically allows **100** connections. `replicas × pool` must stay under that, plus one for migrations/ops | No production `pg_stat_activity` capture in-repo |
| Events | Webhook + reconcile volume ≈ captured checkouts. Sweeps: expiry 30s; PayPal GET batch 20 / 60s; ledger 60s; outbox skip-locked | Intervals from ADR 0001 / 0002 / 0011 / 0012, not event-bus throughput |

## Scale-out (what we will actually do)

```text
Internet → N × Render web instances (same Docker image)
                → one Render PostgreSQL
                → PayPal / Resend
```

1. **API:** add Render instances of `neon-arsenal-api`. Invariants live in PostgreSQL, so replicas are safe (duplicate in-process timers are no-ops).
2. **PostgreSQL:** stay on one primary. The ceiling is **connections and row locks**, not “add Kafka.” If lock waits dominate on **different** listings, more API replicas + watching the connection budget is the first move (`scaling-path.md`).
3. **Do not** add Redis, Kafka, SQS, a worker service, or read replicas for correctness.

Free Render web instances spin down after ~15 minutes idle; a sleeping instance cannot sweep until the next request (`docs/operations/runbook.md`). That is an operational limit, not a capacity number.

## When to replace hypotheses with measurements

Run issue #55 with the committed harness and procedure in `load-tests/k6/` and `docs/performance/load-testing.md` against a production-like API + Postgres **before** quoting RPS targets in SLOs. Until then, operators use `docs/operations/slos.md` (instrument-based) and `docs/performance.md` (plan shape), not invented load-test tables.

If `GET /listings` p95 exceeds ~50 ms with an EXPLAIN that blames `COUNT(*)` or deep `OFFSET`, follow `scaling-path.md` (cursor mode is already shipped). That still does not justify Redis (ADR 0018).
