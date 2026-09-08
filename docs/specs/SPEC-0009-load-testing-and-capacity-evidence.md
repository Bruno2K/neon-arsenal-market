---
id: SPEC-0009
status: Accepted
version: 1
source_issue: "#55"
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-07
---

# [SPEC-0009] — Reproducible load testing and capacity evidence

## Status

`Accepted`

## Problem

The repository has query-plan measurements and capacity hypotheses, but no reproducible offered-load harness. It therefore cannot state throughput, latency under concurrency, or the resource that saturates first. Adding Redis, a broker, or AWS before that evidence would be speculation.

## Goal

Provide safe, reproducible k6 profiles and a report contract that correlate HTTP RPS/p50/p95/p99/errors with API and PostgreSQL resource evidence, without silently mutating production or triggering PayPal side effects.

## Actors

- Load-test operator
- k6 runner
- Isolated Neon Arsenal API and PostgreSQL
- PayPal Sandbox only when separately approved

## Scope

- Read-only catalog smoke and arrival-rate profiles.
- Explicit opt-in order creation using disposable active listing IDs.
- Idempotent payment-link replay using pre-warmed completed links.
- Invalid-signature webhook rejection at the trust boundary.
- JSON summaries, metric thresholds, resource-correlation procedure and report template.

## Non-goals

- Running destructive load against the public demo or real user data.
- PayPal OrdersCreate/OrdersCapture throughput claims.
- Forging or weakening PayPal webhook verification.
- Installing Redis, Kafka, SQS, AWS, Terraform, Grafana, or Prometheus.
- Superseding ADR 0018 or ADR 0019 without measured evidence.
- Treating harness thresholds as production SLOs.

## Business Rules

- `BR-01`: The default profile is read-only and targets localhost unless `BASE_URL` is explicit.
- `BR-02`: Order load requires `ALLOW_WRITES=true` and disposable listing IDs; one iteration consumes one unique listing.
- `BR-03`: Payment load is replay-only and preflights that every order already exposes `paypalOrderId`; no new PayPal side effect is authorized.
- `BR-04`: Webhook load proves invalid signatures are rejected before persistence; valid signed webhook load remains operator-gated.
- `BR-05`: Every accepted capacity result records commit, environment, dataset, workload, UTC window, k6 percentiles/errors and API/PostgreSQL resource signals.
- `BR-06`: A single run or a k6-only summary is not a capacity claim.

## Invariants

- `INV-LISTING-EXCLUSIVE-RESERVE`
- `INV-ORDER-IDEMPOTENT-CREATE`
- Payment-link uniqueness by `PaymentLink.orderId`
- `INV-PAYMENT-TRUSTED-CONFIRM`

## State Transitions

Only the opt-in orders profile performs the existing transition `ACTIVE → RESERVED` through normal order creation. Other profiles do not introduce domain transitions.

## API / Data Contract

No public API or schema change. The harness uses `/api/v1/listings`, `/api/v1/auth/login`, `/api/v1/orders`, `/api/v1/payments/create`, and `/api/v1/payments/webhook` under their existing contracts.

## Concurrency Model

Catalog uses arrival rate. Order iterations use distinct listing IDs and distinct idempotency keys so unrelated row locks can be measured. Payment replay may run concurrently against the same completed durable claim. The harness does not change database isolation or retry behavior.

## Failure Modes

- Missing profile inputs abort before sustained traffic.
- Order profile without explicit write opt-in aborts.
- Insufficient VUs surface as dropped iterations rather than a false achieved-RPS claim.
- A non-pre-warmed payment order is rejected during setup before the payment endpoint receives load.
- k6 cannot observe resource saturation alone; missing correlated resource evidence keeps the report provisional.

## Security

Credentials come from environment variables and must not be committed or written to summaries. The webhook profile must not bypass signature verification. Tests use isolated disposable data. Request bodies and output must not contain JWTs, PayPal secrets, or PII.

## Observability

Each run records achieved RPS, p50/p95/p99, checks, custom failure rates and dropped iterations. Operators correlate the exact UTC window with API CPU/memory/restarts, OTel HTTP/DB metrics where enabled, and PostgreSQL connections/waits/deadlocks.

## Backward Compatibility

No runtime, API, schema, deploy or client behavior changes. This adds an operator harness and documentation only.

## Acceptance Criteria

- [ ] `AC-01` — A default read-only smoke profile and a configurable catalog arrival-rate profile produce JSON summaries with RPS and latency percentiles. **Evidence:** k6 inspect/runtime
- [ ] `AC-02` — Order creation is impossible without explicit write opt-in and disposable listing IDs. **Evidence:** static check/runtime
- [ ] `AC-03` — Payment replay and invalid-webhook profiles exercise existing safety/idempotency boundaries without authorizing capture or valid forged events. **Evidence:** static check/manual review
- [ ] `AC-04` — Profile thresholds fail on checks/custom failures and p95/p99 regressions. **Evidence:** k6 inspect
- [ ] `AC-05` — The procedure requires correlated CPU, memory, connections, waits, deadlocks and invariant evidence. **Evidence:** static check
- [ ] `AC-06` — A report template separates measured facts from hypotheses and records the first bottleneck. **Evidence:** static check
- [ ] `AC-07` — At least one isolated production-like run covers each profile and three repetitions support any committed capacity claim. **Evidence:** runtime/external evidence
- [ ] `AC-08` — Existing API/payment/schema/deploy behavior is unchanged. **Evidence:** diff review and existing tests

## Verification Strategy

- `k6 inspect load-tests/k6/neon-arsenal.js`
- `k6 run` for each profile against an isolated production-like deployment.
- `python3 scripts/ai-factory/validate.py`
- Existing backend typecheck/unit/integration suite; diff review proves no runtime change.
- Provider/API/PG charts and SQL snapshots over the same UTC window.

## Decisions / References

- ADR 0006 (hot-path indexes), ADR 0007 (current Render platform), ADR 0018 (Redis not adopted), ADR 0019 (broker/worker not adopted)
- `docs/architecture/capacity.md`, `docs/architecture/scaling-path.md`, `docs/performance.md`

## Traceability

```text
GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `#55`
- Spec: `SPEC-0009`
- Plan: `PLAN-0006`
- Tasks: `TASK-0010`
- PR: pending
- Verification/Convergence: pending runtime evidence
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Accepted harness and evidence contract — 2026-09-07
