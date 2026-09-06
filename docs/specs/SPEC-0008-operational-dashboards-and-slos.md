---
id: SPEC-0008
status: Accepted
version: 1
source_issue: "#62"
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0008] — Operational dashboards and SLOs from existing telemetry

## Status

`Accepted`

Issues `#62` and `#63` authorize turning the existing OpenTelemetry instruments into operator-facing dashboards, alerts, SLOs, and a request/trace diagnosis procedure. This Specification is the contract. It does not authorize a metrics vendor, a Grafana/Prometheus server, Redis, Kafka, SQS, AWS, or new business metrics.

## Problem

HTTP, Prisma, PayPal, and checkout workflow telemetry already exist (`docs/observability.md`, ADR 0004). Operators still lack:

- a dashboard map that names the real meters, labels, and spans;
- alert thresholds written as runbook guidance;
- a repeatable way to diagnose a failure with `X-Request-Id` / `trace_id`;
- SLOs that cite instruments that can be measured today, plus an error-budget rule.

Inventing Grafana Cloud, Prometheus, or new gauges would hide the fact that some requested SLIs (buyer time-to-PAID, reconciliation lag) are not instrumented.

## Goal

An operator can diagnose API, order, payment, webhook, reconciliation, and database incidents using only instruments and attributes that already exist in `server/src/shared/observability/`, plus PostgreSQL queries already in the runbook. Each SLO names its SLI instrument. Where a requested SLI cannot be measured, the document says so and names the existing proxy.

## Actors

- Operator reading Render logs and optional OTLP export
- API process (`neon-arsenal-api` on Render)
- PostgreSQL (source of truth for pending orders, webhook rows, listings)
- PayPal (unreliable external ledger)
- In-process jobs: reservation expiry, PayPal GET reconciliation, seller ledger reconciliation, outbox dispatch

## Scope

- Dashboard definitions for API, Orders, Payments, webhooks, reconciliation, and database.
- Critical traces, allowed labels, and alert thresholds as runbook guidance.
- Diagnosis procedure: `X-Request-Id` → `request.id` → `trace_id` / `span_id` → child spans → logs → SQL.
- SLOs for availability, catalog/checkout latency, payment-path errors, and reconciliation using existing instruments or documented proxies.
- Basic error-budget rule.
- A unit test that the documented metric names and span names still exist.

## Non-goals

- Grafana, Prometheus, Tempo, Jaeger, Grafana Cloud, or any metrics SaaS.
- Redis, Kafka, SQS, AWS, CloudWatch, Terraform.
- New meters, gauges, env vars, or span names.
- Changing reservation, payment, webhook, or refund semantics.
- Inventing a PayPal refund/void API.
- A pending-order gauge (ADR 0004: query PostgreSQL).
- Buyer-perceived time from checkout start to `PAID` (not instrumented).
- Storefront product-analytics events (`docs/product-analytics.md`).
- Editing `src/`.

## Business Rules

- `BR-01`: Dashboard panels and SLOs may cite only meter names, histogram units, span names, and attribute keys that exist in `server/src/shared/observability/` (or config constants those spans already record).
- `BR-02`: Metric attributes stay low-cardinality: HTTP method/route/status, Prisma `db.operation`/`db.collection`, PayPal `paypal.operation`. No user, order, listing, email, or token labels.
- `BR-03`: HTTP 4xx business outcomes (`app.outcome` such as `reservation_conflict`, `idempotency_conflict`, `reservation_expired`) are not availability failures. Availability uses `http.server.errors` (5xx) over `http.server.request.count`.
- `BR-04`: `/health` and `/ready` are excluded from HTTP metrics and spans. Render readiness is a separate probe, not an SLI sample.
- `BR-05`: If a requested SLI has no instrument, document it as unmeasurable and name the existing proxy. Do not invent a number that cannot be computed from current export.
- `BR-06`: Alerts are runbook thresholds. Do not add a pager vendor.
- `BR-07`: Diagnosis uses `X-Request-Id` / `request.id` / `trace_id` / `span_id`. Do not tell operators to search logs for JWTs, PayPal tokens, webhook signatures, or emails.
- `BR-08`: `paypal.webhooks.failed` and `payments.failed` mix operational failures with expected business results (including `reservation_expired`). They are investigation signals, not availability SLIs.
- `BR-09`: Production remains Render (ADR 0007). Optional OTLP is not CloudWatch.

## Invariants

No domain invariant changes. Relevant existing invariants stay authoritative:

- `INV-LISTING-EXCLUSIVE-RESERVE`
- Payment confirmation remains PayPal-trusted (`INV-PAYMENT-TRUSTED-CONFIRM` in code comments)
- Seller ledger: `Seller.balance` is a projection of PAID `SellerTransaction` SUM

## State Transitions

None. This Specification does not change listing, order, payment, webhook, or outbox state machines.

```text
(no domain transitions)
```

## API / Data Contract

No new HTTP routes, headers, env vars, or Prisma fields.

The operational contract is the instrument catalog in `docs/operations/dashboards/neon-arsenal-api.json` and the SLO table in `docs/operations/slos.md`. HTTP `http.route` includes both unversioned paths and the `/api/v1` prefix (SPEC-0007).

## Concurrency Model

Documentation and a catalog test only. No new concurrent writes. Existing reservation, idempotency, webhook claim, and reconciliation concurrency are unchanged.

## Failure Modes

- OTEL off (`OTEL_ENABLED` unset): logs still have `X-Request-Id`. Spans/metrics are not exported. Diagnosis falls back to Render logs + SQL.
- OTEL on, exporter `none`/`console`: in-process correlation only; dashboard queries need an OTLP backend the operator already has, or console output.
- Unreachable OTLP endpoint: request handling continues (existing SDK behavior).
- Render free-tier spin-down: no HTTP samples while the instance is asleep. Availability SLI is defined only over recorded requests.
- Process crash after PayPal capture: webhook retry + GET reconciliation (existing). No new recovery path.
- Capture after reservation expiry: still 409 locally, HTTP 200 to PayPal, manual PayPal dashboard reversal (`docs/operations/runbook.md`). Metrics increment `payments.failed` / `paypal.webhooks.failed` with span `app.outcome=reservation_expired`.

## Security

Telemetry must not include passwords, JWTs, `Authorization`, PayPal access tokens, `paypal-transmission-sig`, payment credentials, SQL text, bind parameters, or user/order/listing IDs as metric labels (`safeAttributes()`). Dashboard JSON and SLO docs must not add those dimensions. Diagnosis must not ask operators to paste secrets into tickets.

## Observability

This Specification *is* the observability operations contract. It reuses:

- HTTP: `http.server.request.count`, `http.server.request.duration`, `http.server.errors`
- Database: `db.client.operation.duration`, `db.client.errors`
- PayPal client: `paypal.client.request.count`, `paypal.client.errors`, `paypal.client.timeouts`, `paypal.client.request.duration`
- Business counters already listed in `docs/observability.md`
- Spans already listed there, plus `payments.create_link` and `payments.capture` which exist in code
- Correlation: `X-Request-Id` = `request.id` = Pino `requestId`; `trace_id` / `span_id` on logs when a span is active

## Backward Compatibility

No API, schema, or client change. Enabling `OTEL_ENABLED` remains optional. Existing tests that assert low-cardinality attributes and secret redaction stay in force.

## Acceptance Criteria

- [ ] `AC-01` — Dashboards for API, Orders, Payments, webhooks, reconciliation, and database name only existing meters, labels, and spans. **Evidence:** static check
- [ ] `AC-02` — Alert thresholds exist as runbook guidance and do not introduce a pager or metrics vendor. **Evidence:** static check
- [ ] `AC-03` — A written procedure diagnoses a failure using `X-Request-Id` / `request.id` / `trace_id` without searching for secrets. **Evidence:** static check
- [ ] `AC-04` — Each SLO cites an existing instrument or an explicit unmeasurable + proxy. **Evidence:** static check
- [ ] `AC-05` — Availability SLI uses 5xx (`http.server.errors`) over recorded HTTP (`http.server.request.count`), not 4xx business outcomes. **Evidence:** static check
- [ ] `AC-06` — Error budget is defined from the availability SLO over a 30-day window of recorded requests. **Evidence:** static check
- [ ] `AC-07` — A unit test proves documented metric names still exist and keep documented attribute keys. **Evidence:** test
- [ ] `AC-08` — Reservation and payment semantics, env vars, and PayPal contracts are unchanged. **Evidence:** manual review

### Acceptance rules

1. Criteria must describe observable outcomes, not implementation steps.
2. Criteria must be deterministic enough for an independent verifier to judge.
3. Criteria must cover important failure and security behavior, not only the happy path.
4. A criterion is not accepted because a test passes when the test does not actually prove the criterion.

## Verification Strategy

- Required commands/checks: `cd server && npm run test:unit`; `python3 scripts/ai-factory/validate.py`
- Unit tests: instrument catalog vs `docs/operations/dashboards/neon-arsenal-api.json` and source span names
- Integration/concurrency tests: not required (no runtime semantics change)
- Security/contract checks: catalog test forbids high-cardinality / sensitive metric attributes
- Runtime/manual checks: none required (no Grafana server)
- Required external evidence: none

The final implementation must be traceable from each material acceptance criterion to evidence.

## Decisions / References

- ADR 0004 — OpenTelemetry without an observability platform
- ADR 0007 — Render is the production target
- `docs/observability.md` — instrument list
- `docs/operations/runbook.md` — deploy, probes, payment inspection
- `docs/architecture/failure-modes.md` — recovery map
- `docs/performance.md` / `docs/architecture/scaling-path.md` — catalog p95 trigger (~50 ms)
- `server/src/shared/config/paypal.ts` — 10 s PayPal timeout, 60 s reconcile, 2 min min-age
- Issues `#62`, `#63`

## Traceability

Material changes must preserve this chain:

```text
GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

### Traceability metadata

- Issue: `#62` (grouped with `#63`)
- Spec: `SPEC-0008`
- Plan: `PLAN-0005`
- Tasks: `TASK-0008`, `TASK-0009`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending
- Memory: pending

The frontmatter `source_issue` must use the canonical GitHub Issue reference format `#<number>` and identify the material Issue that authorized this Specification.

## Change History

- `v1` — Initial accepted contract for issues #62 and #63 — 2026-09-06
