---
id: PLAN-0005
status: Ready
version: 1
source_spec: SPEC-0008
source_spec_version: 1
baseline_revision: 27c94eb46d24353aee866852236c83134a89702e
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [PLAN-0005] — Operational dashboards and SLOs from existing telemetry

## Status

`Ready`

## Source

- Specification: `SPEC-0008` v1
- Issue: `#62` (grouped with `#63`)
- Planning task: Backend → Reliability → Security → Test → Verification
- Baseline: `27c94eb46d24353aee866852236c83134a89702e`

The Plan derives implementation work from the Specification. It may narrow implementation choices but must not add, remove, or reinterpret acceptance criteria.

## Current State

Inspected at the baseline:

- `server/src/shared/observability/metrics.ts` defines HTTP, DB, PayPal, and unlabeled business counters. No pending-order gauge.
- `http.ts` records `http.route` as `${baseUrl}${route.path}` (unversioned and `/api/v1` prefixes). Skips `/health` and `/ready`. Sets `request.id`.
- Workflow spans exist in orders, listings, payments, commissions, outbox, Prisma, and PayPal helpers. `docs/observability.md` omits `payments.create_link` and `payments.capture`.
- `payments.failed` and `paypal.webhooks.failed` increment on `reservation_expired` as well as operational errors.
- Reconciliation: `PAYPAL_RECONCILE_INTERVAL_MS = 60_000`, `PAYPAL_RECONCILE_MIN_AGE_MS = 2 * 60 * 1000`, batch 20. Span attributes `app.reconcile_scanned` / `app.reconcile_confirmed`. No lag histogram.
- PayPal HTTP timeout default 10 s (`PAYPAL_API_TIMEOUT_MS`).
- Catalog p95 trigger already documented at ~50 ms (`docs/architecture/scaling-path.md`). Local `listingsService.list` p95 ~4 ms (`docs/performance.md`).
- ADR 0004 forbids a local Grafana/Prometheus/Jaeger dependency. ADR 0007 keeps Render.
- No `docs/operations/dashboards.md` or `docs/operations/slos.md` at baseline.

## Goal

Publish operator dashboards, SLOs, error budget, alert thresholds, and a request/trace diagnosis procedure that cite only existing telemetry, plus a unit test that the catalog still matches code.

## Affected Areas

- `docs/operations/dashboards.md`, `docs/operations/slos.md`, `docs/operations/dashboards/neon-arsenal-api.json`
- `docs/observability.md`, `docs/operations/runbook.md`
- `docs/architecture/current-state.md`, `docs/roadmap.md`, `README.md` (pointers only)
- `docs/specs/SPEC-0008-*`, this Plan, `TASK-0008`, `TASK-0009`
- `server/src/shared/observability/__tests__/instrument-catalog.test.ts` only

Do not edit `src/`. Do not change reservation/payment runtime.

## Architecture

Modular monolith on Render + PostgreSQL. Optional OTLP export. Dashboards are committed definitions, not a running observability platform. PostgreSQL remains SoT for pending-order and webhook investigation.

## Database

No schema or migration changes. Operators continue to use the existing runbook SQL for `PENDING` orders and `PaymentWebhookEvent`.

## Implementation Sequence

1. Accept `SPEC-0008` and mark this Plan Ready against baseline `27c94eb46d24353aee866852236c83134a89702e`.
2. Write the vendor-neutral dashboard JSON and markdown map (`TASK-0008`).
3. Write SLOs, proxies, error budget, runbook alerts, and diagnosis (`TASK-0009` docs half).
4. Add the instrument-catalog unit test (`TASK-0009` test half).
5. Link from observability, current-state, roadmap, and README.
6. Verify with unit tests and factory validation.

## Task Graph

```text
TASK-0008 → TASK-0009
```

`TASK-0009` consumes the JSON catalog from `TASK-0008` as the executable name list.

## Testing Strategy

Unit test records every documented histogram/counter and asserts names plus allowed attribute keys. It also asserts documented span name strings still appear in the files that create them. Existing telemetry redaction and business-outcome tests remain. No integration test: no runtime semantics change.

## Verification Strategy

```bash
python3 scripts/ai-factory/validate.py
cd server && npm run test:unit
```

Map: AC-01–AC-06 → dashboard/SLO/runbook docs; AC-07 → instrument-catalog test; AC-08 → diff review (no `src/`, no payment/reservation edits).

## Risks

- Treating `paypal.webhooks.failed` as an availability SLI would page on expected `reservation_expired`. Mitigation: BR-08; SLOs use `http.server.errors` and PayPal client timeouts/errors.
- Inventing catalog/checkout p95 targets without production samples. Mitigation: catalog uses the existing 50 ms scaling trigger; checkout/payment numeric targets are watches derived from the 10 s PayPal timeout or are marked unmeasurable.
- Dual `http.route` prefixes splitting series. Mitigation: dashboards and SLOs name both `/listings` and `/api/v1/listings` (and the other pairs).

## Dependencies

`SPEC-0008` Accepted. Baseline commit present in the worktree.

## Stop Conditions

- A requirement to add Grafana Cloud, Prometheus, Redis, or a new meter.
- A requirement to invent a PayPal refund API or change payment confirmation.
- Contradiction between an SLO number and the instruments that exist at baseline.

## Definition of Done

Dashboard + SLO docs exist, cite only real instruments, include diagnosis and error budget, catalog unit test passes, factory validation passes, and the diff does not change reservation/payment semantics.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `#62` / `#63`
- Spec: `SPEC-0008` v1
- Plan: `PLAN-0005`
- Tasks: `TASK-0008`, `TASK-0009`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready plan for SPEC-0008 — 2026-09-06
