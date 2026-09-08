# Load-test report — YYYY-MM-DD — PROFILE

## Identity

- Git SHA:
- Image digest:
- UTC window:
- Operator:
- k6 profile / run ID:

## Environment

- API replicas / CPU / memory / Node:
- PostgreSQL version / tier / connection limit:
- Dataset: products / listings by status / orders / payment links:
- External dependencies enabled:

## Workload

- Offered load and stages:
- VUs / arrival-rate settings:
- Mutation inputs and cleanup:

## Results

| Metric | Result | Threshold | Pass |
|---|---:|---:|:---:|
| Achieved RPS | | n/a | |
| p50 | | n/a | |
| p95 | | profile threshold | |
| p99 | | profile threshold | |
| HTTP/custom failure rate | | < 1% | |
| Dropped iterations | | 0 sustained | |
| API peak CPU | | environment-qualified | |
| API peak memory | | below limit/no OOM | |
| PostgreSQL peak connections | | retains operator headroom | |
| Lock waits / deadlocks | | explained / 0 deadlocks | |

## Invariant verification

- Orders created vs unique idempotency keys:
- Listings reserved exactly once:
- Duplicate `PaymentLink.orderId` rows:
- Unexpected webhook persistence:
- Verification commands:

## Bottleneck and decision

- First saturated resource:
- Evidence:
- Lowest-complexity mitigation:
- Does this trigger an ADR 0018/0019 review? Why?
- Capacity statement that may be added to `docs/architecture/capacity.md`:

## Artifacts

- k6 summary JSON:
- API/OTel/provider charts:
- PostgreSQL snapshots:
- Logs/request IDs (no secrets):
