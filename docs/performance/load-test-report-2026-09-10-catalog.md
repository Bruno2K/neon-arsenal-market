# Load-test report — 2026-09-10 — catalog

Evidence class: controlled CI capacity evidence

This report is **not Render or production capacity**. It describes one explicitly bounded GitHub-hosted CI topology. The catalog-only benchmark lifts the public per-client API quota inside the disposable no-egress environment so the API/PostgreSQL hot path, rather than the single-source-IP quota, is measured.

## Identity

- Git SHA: `87c73d3ee974d1de92a0bce4c4369bb7be806e1b`
- Workflow run: `34439840030` — `Controlled CI catalog claim evidence`
- Frozen API image ID, identical in all three repetitions: `sha256:0f301df67fd9d92e8f703d7c9f2c28d695694a45ce4bf0800a1a09e6bfd484eb`
- Frozen API artifact digest: `sha256:90a9590a5294a16448f2fda5e4fb850b0b9c7265ecd85541ad5278fce2bc1a3c`
- PostgreSQL image ID, identical in all three repetitions: `sha256:75f5a96988cdf694a215073c3e9c001b706b371e2f94df3967f2efdec2787f6b`
- k6 image ID, identical in all three repetitions: `sha256:00cfdae7945825029ce3270b3479992e411f309c2dc968820543d2183d0bbe5e`
- Operator: GitHub Actions `workflow_dispatch`

## Environment

- API: one production Docker image replica, `NODE_ENV=production`, `1.0 CPU`, `512 MiB` memory.
- PostgreSQL: `postgres:16-alpine`, `1.0 CPU`, `1 GiB` memory, `max_connections=100`, `shared_buffers=256MB`.
- k6: `grafana/k6:2.2.0`, co-located on the GitHub-hosted runner but outside the API container CPU/memory limits.
- Network: API, PostgreSQL and k6 on an internal Docker network; no provider egress and no host-published API port.
- Dataset: fresh seeded database and equivalent disposable fixture shape for each repetition; catalog invariant verification retained 20 disposable `ACTIVE` listings and observed no order or webhook side effect.
- Catalog benchmark rate-limit override: `RATE_LIMIT_API_MAX=100000` only inside this isolated benchmark. This does not change the deployed production default or authorize a client to send this rate publicly.
- Runner uncertainty: GitHub-hosted runner allocation remains external to the repository. The repetitions nevertheless stayed close despite running on separate hosted workers; this is controlled-CI evidence, not a hardware certification.

## Workload

- Profile: `catalog` / `catalog_browse`.
- Endpoint: existing `GET /api/v1/listings?cursor=&limit=20` path.
- Executor: ramping arrival rate.
- Start: `5 RPS`.
- Ramp: `30s` to `150 RPS`.
- Hold: `60s` at `150 RPS`.
- Cooldown: `15s` to zero.
- k6 allocation: `20` preallocated VUs, `100` maximum VUs.
- Mutation: none through the API. Disposable fixtures exist only to keep invariant checks equivalent to the general harness.

The `http_reqs.rate` below is the average across ramp + hold + cooldown. It is therefore approximately `118.56 RPS`; it must not be confused with the `150 RPS` sustained hold target. The execution logs show the 60-second hold maintaining `150.00 iterations/s` with no dropped iterations.

## Equivalent repetitions

| Repetition | Requests | Global avg RPS | p50 | p95 | p99 | HTTP failures | Dropped |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 12,449 | 118.56 | 4.32 ms | 6.08 ms | 10.81 ms | 0% | 0 |
| 2 | 12,450 | 118.56 | 4.13 ms | 5.81 ms | 12.27 ms | 0% | 0 |
| 3 | 12,449 | 118.56 | 4.31 ms | 6.01 ms | 11.82 ms | 0% | 0 |
| Median | — | 118.56 | 4.31 ms | 6.01 ms | 11.82 ms | 0% | 0 |

Thresholds remained green in all three repetitions (`catalog` p95 `<500 ms`, p99 `<1000 ms`, checks/failure guardrails). The small percentile spread, zero failures and zero drops support treating this point as reproducible within this controlled CI environment.

## Correlated resource evidence

Each repetition captured 18 synchronized two-second resource samples over the k6 window.

| Repetition | API CPU median / max | API container memory median / max | API RSS median / max | PG CPU median / max | PG max connections | PG max active | PG max waiting | Deadlocks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 59.13% / 72.74% | 43.29 / 43.96 MiB | 95.67 / 96.11 MiB | 7.12% / 11.18% | 6 | 1 | 5 | 0 |
| 2 | 57.29% / 67.06% | 43.35 / 44.75 MiB | 95.64 / 96.02 MiB | 6.12% / 12.35% | 6 | 1 | 5 | 0 |
| 3 | 59.37% / 67.27% | 43.38 / 43.76 MiB | 95.73 / 95.94 MiB | 7.07% / 12.46% | 6 | 1 | 5 | 0 |

The PostgreSQL `waiting` samples are not evidence of lock contention by themselves: idle connections can report wait events while waiting for client activity. The post-run snapshots and counters recorded zero deadlocks, and the healthy 150-RPS runs show no latency or throughput symptom consistent with a database bottleneck.

## Invariant verification

All three repetitions passed the post-run invariant gate:

- all 20 disposable order-test listings remained `ACTIVE`;
- zero orders consumed those listings;
- zero unexpected webhook events were persisted;
- no seller/payment side effect was created by the read-only catalog traffic.

## Boundary experiments and first bottleneck

The qualification process deliberately tested beyond the stable point before committing a number. A single earlier 200-RPS-target probe passed, but a subsequent three-repetition set at the same target was **not reproducible**: all three runs crossed the catalog latency threshold and dropped iterations. Targets `205`, `210`, `225`, `250`, `300` and `400` also showed saturation.

At the failed 200-RPS three-run boundary, the API consumed approximately its full `1 CPU` container budget while PostgreSQL remained around the low-teens CPU range, with no deadlocks, OOM or API restart. The first observed bottleneck is therefore **API CPU under the 1-CPU controlled-CI limit**, not PostgreSQL capacity.

This evidence does not justify Redis, Kafka, SQS, read replicas or a database change. If a higher catalog rate is required in a comparable topology, the lowest-complexity next experiment is additional API CPU/replicas while retaining PostgreSQL connection-budget observation.

## Qualified capacity statement

> In the controlled GitHub Actions topology — one production API container limited to 1 CPU/512 MiB and PostgreSQL limited to 1 CPU/1 GiB — the catalog workload sustained its configured **150 RPS hold for 60 seconds** in three serial equivalent repetitions using the exact same frozen API image. All three runs had **0 HTTP failures**, **0 dropped iterations**, p95 between **5.81–6.08 ms**, and p99 between **10.81–12.27 ms**. API CPU peaked between **67.06–72.74%** at this qualified point. This is controlled-CI evidence, not Render or production capacity.

## Artifacts

- Workflow run: `https://github.com/Bruno2K/neon-arsenal-market/actions/runs/34439840030`
- Repetition 1 artifact: `catalog-claim-r1-34439840030-1` (`10137599050`)
- Repetition 2 artifact: `catalog-claim-r2-34439840030-1` (`10137661550`)
- Repetition 3 artifact: `catalog-claim-r3-34439840030-1` (`10137722220`)
- Frozen API image artifact: `catalog-claim-api-image-34439840030-1` (`10137539189`)
- Each repetition includes k6 summary/inspect output, synchronized resource samples, PostgreSQL pre/post snapshots, API/PostgreSQL logs, image IDs, exact commit, resource limits and invariant output.
