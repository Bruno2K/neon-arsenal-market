# Load-testing procedure

Contract: `SPEC-0009`. Harness: `load-tests/k6/neon-arsenal.js`. Issue: #55.

For the GitHub Actions + isolated Render execution path, including the exact
dashboard-only setup, see `docs/operations/load-test-ci.md`.

## Safety gate

Use an isolated API and PostgreSQL database with production-like limits and disposable fixtures. Do not run write profiles against the public demo or a database containing user data. Do not run PayPal capture/webhook-success traffic without explicit operator approval and PayPal Sandbox isolation.

Before a run, record:

- git commit SHA and deployed image digest;
- environment shape: API replicas, CPU/memory limit, Node version;
- PostgreSQL version/tier, connection limit and dataset cardinalities;
- profile, environment variables (excluding secrets), UTC start/end;
- expected mutation and cleanup/restore procedure.

## Required sequence

1. `smoke`: prove connectivity and response shape.
2. `catalog`: ramp offered load until latency/errors/dropped iterations identify a knee, not until the service crashes.
3. `orders`: load a disposable set of unique active listings; one iteration consumes one listing.
4. `payment_replay`: use only orders with a completed persisted payment link, proving the idempotent replay path without another PayPal `OrdersCreate`.
5. `webhook_rejection`: measure the unauthenticated trust-boundary rejection path.
6. Cool down, capture final database state, and verify invariants/tests.

Run one profile at a time. Repeat each stable point at least three times; report the median run and the spread. A single run is a probe, not a capacity claim.

## Metrics to capture

| Layer | Minimum evidence |
|---|---|
| k6 | achieved RPS, p50/p95/p99, checks, HTTP failure rate, dropped iterations, data received/sent |
| API | CPU, RSS/memory, event-loop symptoms, 5xx, request duration, restarts, replica count |
| PostgreSQL | `numbackends`, active/idle connections, transaction rate, lock waits, deadlocks, slow statements, CPU/storage latency when the provider exposes them |
| Domain | created orders, reserved listings, duplicate idempotency rows, duplicate payment links, webhook rows |

Suggested PostgreSQL snapshots during the run:

```sql
SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state;
SELECT wait_event_type, wait_event, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY wait_event_type, wait_event;
SELECT deadlocks, xact_commit, xact_rollback FROM pg_stat_database WHERE datname = current_database();
```

Provider charts and SQL snapshots must cover the same UTC window as the k6 JSON summary. Do not infer database saturation from HTTP latency alone.

## Capacity decision rule

Record the highest repeatable offered rate where all of these remain true:

- achieved rate tracks offered rate without sustained dropped iterations;
- profile checks and custom failure rate meet the committed thresholds;
- no process restart/OOM and no sustained CPU or memory saturation;
- PostgreSQL connections retain operational headroom and lock waits are explained;
- domain invariants remain intact after the run.

The committed thresholds are test guardrails, not production SLOs. Update `docs/architecture/capacity.md` only with measured environment-qualified results.

## Architecture gate

After evidence exists, compare the bottleneck to `docs/architecture/scaling-path.md`:

- Shared rate-limit bypass across replicas can justify revisiting ADR 0018 for Redis.
- Catalog DB saturation can justify query/pagination work first; cache is not automatic.
- In-process job lag or sustained outbox backlog can justify revisiting ADR 0019 for SQS or another broker.
- AWS/ECS/RDS/ElastiCache work (#66/#67) needs an environment/cost objective, not only a technology checklist.
- Kafka requires an independently demonstrated ordering, replay, partition-throughput, or multi-consumer requirement. SQS remains the current backlog candidate; do not substitute Kafka by name alone.

Use `docs/performance/load-test-report-template.md` for every accepted run.
