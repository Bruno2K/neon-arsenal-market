---
id: PLAN-0006
status: Ready
version: 1
source_spec: SPEC-0009
source_spec_version: 1
baseline_revision: 624f14a0ed3bbd8a2671e1fcace0f70866ab9106
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-07
---

# [PLAN-0006] — k6 load testing and capacity evidence

## Status

`Ready`

## Source

- Specification: `SPEC-0009` v1
- Issue: `#55`
- Planning task: performance evidence before infrastructure expansion
- Baseline: `624f14a0ed3bbd8a2671e1fcace0f70866ab9106`

## Current State

The baseline contains EXPLAIN/query timing evidence, capacity hypotheses, OTel instruments and explicit scale triggers. It has no k6 scripts or load reports. ADR 0018 rejects Redis and ADR 0019 rejects SQS/Kafka until a measured trigger exists.

## Goal

Add the safe k6 harness, operating procedure and report contract; then execute it in an isolated production-like environment before publishing capacity numbers or changing infrastructure ADRs.

## Affected Areas

- `load-tests/k6/`
- `docs/performance/`
- `docs/specs/SPEC-0009-*`, this Plan and `TASK-0010`

No application source, schema, migration, dependencies, deploy config or public API changes.

## Architecture

k6 remains an external test driver. The modular monolith and Render deployment remain unchanged. No ADR is needed for the harness; Redis/broker/AWS decisions require later ADRs only after evidence.

## Database

No schema change. The opt-in orders profile mutates disposable fixture rows through the existing API. Reports verify idempotency and listing/payment constraints after each run.

## Implementation Sequence

1. Accept `SPEC-0009` and bind this Ready Plan to the exact baseline.
2. Implement profiles, checks, thresholds, input gates and JSON summary.
3. Document environment/resource capture and reporting.
4. Validate static factory rules and k6 script inspection when the binary is available.
5. Deploy/provision an isolated production-like target and run all profiles three times.
6. Update capacity evidence and evaluate whether an ADR 0018/0019 review is triggered.

## Task Graph

```text
TASK-0010 harness → isolated runtime evidence → architecture decision
```

The sequence is intentionally serial because architecture conclusions depend on runtime results.

## Testing Strategy

`k6 inspect` validates script/options. Smoke validates connectivity. Each profile has status/shape checks and a custom failure rate. Existing backend tests prove no runtime regression because the diff is test/docs only. Runtime validation includes post-run invariant queries.

## Verification Strategy

```bash
python3 scripts/ai-factory/validate.py
k6 inspect load-tests/k6/neon-arsenal.js
k6 run load-tests/k6/neon-arsenal.js
```

AC-01–04 map to harness inspection/runtime; AC-05–06 to procedure/template review; AC-07 to external isolated runs; AC-08 to diff and existing CI.

## Risks

- Load against the public demo could disrupt users or mutate durable state. Mitigation: localhost default, explicit write gate and isolated-environment procedure.
- Payment replay fixture not pre-warmed could call PayPal. Mitigation: setup preflights `paypalOrderId` and aborts before payment traffic; there is no capture profile.
- Provisional thresholds could be misquoted as SLOs. Mitigation: spec/docs label them guardrails and require environment-qualified reports.
- k6-only results could misdiagnose the bottleneck. Mitigation: correlated API/PostgreSQL evidence is mandatory.

## Dependencies

An isolated production-like API/PostgreSQL environment and k6 binary are required for AC-07. PayPal Sandbox valid-event load is not required or authorized by v1.

## Stop Conditions

- Target is the public demo or contains non-disposable user data.
- A run would call OrdersCapture or accept unverified success webhooks.
- Credentials would be committed or copied into artifacts.
- A request adds Redis/Kafka/SQS/AWS before a measured trigger and ADR review.

## Definition of Done

Harness/docs are reviewed and inspect successfully; all five profiles run against an isolated production-like target; three repetitions support published capacity claims; resource and invariant evidence is attached; #55 receives the report and may close.

## Traceability

```text
GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `#55`
- Specification: `SPEC-0009` v1
- Plan: `PLAN-0006` v1
- Tasks: `TASK-0010`
- PR: pending
- Verification/Convergence: pending isolated runtime
- Evaluation: pending
- Memory: pending

## Change History

- `v1` — Ready plan for SPEC-0009 — 2026-09-07
