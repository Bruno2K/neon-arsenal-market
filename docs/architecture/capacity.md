# Capacity evidence and scale model

Issue #74. This document separates **measured controlled-CI evidence** from deployment hypotheses. The k6 result below is not Render or production capacity; it describes a bounded GitHub Actions topology using the production Docker image.

Evidence in the repository:

- `docs/performance/load-test-report-2026-09-10-catalog.md` — reproducible controlled-CI catalog capacity evidence from three equivalent k6 repetitions.
- `docs/performance.md` — `EXPLAIN ANALYZE` + `listingsService.list` timings at 2,500 `ACTIVE` listings (`cd server && npm run perf:evidence`).
- `docs/architecture/scaling-path.md` — measured triggers and explicit non-goals (Redis/Kafka/SQS).
- `docs/adr/0006-hot-path-indexes.md` — why the hot-path indexes exist.
- `render.yaml` — one Docker API + one managed PostgreSQL (ADR 0007).

## Measured controlled-CI catalog capacity

On commit `87c73d3ee974d1de92a0bce4c4369bb7be806e1b`, workflow run `34439840030` executed three serial equivalent catalog repetitions with the exact same frozen API image.

Controlled topology:

- API: one production container, `1 CPU`, `512 MiB`, `NODE_ENV=production`.
- PostgreSQL 16: `1 CPU`, `1 GiB`, `max_connections=100`, `shared_buffers=256MB`.
- k6: `grafana/k6:2.2.0` on the same GitHub-hosted worker, API/PostgreSQL traffic on an internal no-egress Docker network.
- Catalog benchmark only: the per-client production quota is lifted inside the disposable environment (`RATE_LIMIT_API_MAX=100000`) so the API/PostgreSQL hot path is measured. The deployed production default is unchanged.

The catalog profile ramps from 5 to 150 RPS for 30 seconds, holds **150 RPS for 60 seconds**, then cools down for 15 seconds. All three repetitions completed with zero HTTP failures and zero dropped iterations:

| Run | p50 | p95 | p99 | API CPU peak | PG CPU peak |
|---|---:|---:|---:|---:|---:|
| 1 | 4.32 ms | 6.08 ms | 10.81 ms | 72.74% | 11.18% |
| 2 | 4.13 ms | 5.81 ms | 12.27 ms | 67.06% | 12.35% |
| 3 | 4.31 ms | 6.01 ms | 11.82 ms | 67.27% | 12.46% |

The whole-run `http_reqs.rate` is about `118.56 RPS` because it includes ramp-up and cooldown; it is not the hold rate. k6 execution logs show the configured 60-second hold at `150.00 iterations/s`.

Qualification intentionally went beyond this point. A single 200-RPS-target probe happened to pass, but a later three-repetition 200-RPS set was not reproducible: all repetitions crossed the latency threshold and dropped iterations. Targets 205, 210, 225, 250, 300 and 400 also saturated. Correlated evidence at the failed 200-RPS boundary showed the API consuming approximately its full 1-CPU budget while PostgreSQL remained in the low-teens CPU range, without deadlocks, OOM or API restarts.

**First measured bottleneck:** API CPU under the 1-CPU controlled-CI limit. The evidence does not identify PostgreSQL, the network, or the public per-client limiter as the first capacity bottleneck for this isolated catalog benchmark.

Qualified statement:

> In the controlled GitHub Actions topology, one production API container limited to 1 CPU/512 MiB sustained a 150-RPS catalog hold for 60 seconds in three equivalent repetitions, with 0 HTTP failures, 0 dropped iterations, p95 5.81–6.08 ms and p99 10.81–12.27 ms. This is controlled-CI evidence, not Render or production capacity.

## Remaining deployment hypotheses

| Dimension | Current position | Evidence / uncertainty |
|---|---|---|
| Users | Single-operator portfolio/demo; no MAU/concurrency claim | No analytics-backed user count. |
| Render RPS | No production RPS claim. Controlled CI demonstrates the bounded result above only | Render CPU scheduling, network, cold starts and managed PostgreSQL differ from GitHub Actions. |
| Read / write mix | Browse/PDP reads are expected to dominate reserve/payment writes | Catalog has measured load evidence; write throughput is not published as a capacity number. |
| Catalog size | Comfortable at a few thousand `ACTIVE` listings in the current evidence fixture; re-run after roughly 10× growth | Existing query-plan fixture has 2,500 `ACTIVE` + 80 `RESERVED` + 80 `SOLD`. |
| Checkout concurrency | Same listing → one `ACTIVE → RESERVED` winner; different listings contend on different rows | Integration tests prove correctness; no checkout RPS claim is published. |
| PostgreSQL connections | Replica count × client pool must retain connection headroom | Controlled catalog evidence peaked at 6 PostgreSQL connections in the bounded topology; production pool/host behavior still needs deployment observation. |
| Events | Webhook + reconcile volume tracks captured checkouts; sweeps remain database-coordinated | Intervals come from ADR 0001 / 0002 / 0011 / 0012, not an event-bus throughput benchmark. |

## Scale-out path

```text
Internet → N × Render web instances (same Docker image)
                → one Render PostgreSQL
                → PayPal / Resend
```

1. **API:** if deployed evidence shows CPU saturation similar to controlled CI, test more API CPU or additional Render instances first. The correctness invariants live in PostgreSQL, so replicas do not require Redis for correctness.
2. **PostgreSQL:** stay on one primary until measured connection, lock, I/O or query evidence says otherwise. Additional API replicas must preserve connection-budget headroom.
3. **Do not** add Redis, Kafka, SQS, a worker service, or read replicas solely because the catalog benchmark found an API-CPU ceiling.

Free Render web instances may sleep while idle; that is an operational deployment characteristic, not a capacity result.

## When to run the next capacity experiment

Re-run controlled evidence when application behavior, Node/runtime image, database shape, catalog cardinality or relevant hot-path code changes materially. For a **Render/production capacity** number, run an explicitly approved deployed benchmark with provider/resource evidence and a separate report; never relabel this GitHub-hosted result.

If higher catalog throughput becomes a concrete requirement, the lowest-complexity next experiment is more API CPU/replicas while observing PostgreSQL connections and waits. Redis, brokers or read replicas require their own measured trigger and ADR review.
