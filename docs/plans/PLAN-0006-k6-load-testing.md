---
id: PLAN-0006
status: Ready
version: 3
source_spec: SPEC-0009
source_spec_version: 3
baseline_revision: 9f4c60885d8a1c9c11362d1b236c6179b7f787e9
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-09
---

# [PLAN-0006] — k6 load testing and capacity evidence

## Status

`Ready`

## Source

- Specification: `SPEC-0009` v3
- External tracker: `#55` (optional)
- Planning task: performance evidence before infrastructure expansion
- Baseline: `9f4c60885d8a1c9c11362d1b236c6179b7f787e9`

## Current State

The baseline contains the five-profile k6 harness and a safe but incomplete ephemeral workflow. The workflow runs `npm start`, exposes only three profiles, has no explicit container limits, fixtures, invariant gate or synchronized resource evidence, and is explicitly ineligible for a capacity claim.

## Goal

Run the production Docker image and PostgreSQL 16 in a controlled, resource-limited, isolated CI topology; generate safe fixtures and complete evidence bundles; then execute all profiles before publishing controlled CI capacity numbers or changing infrastructure ADRs.

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
4. Validate documentation contracts and inspect the k6 script when the binary is available.
5. Build the controlled CI topology, fixture preparation, synchronized sampling, invariant gate and one/three repetition dispatch modes.
6. In subsequent workflow runs, execute all profiles and repeat each claimed stable point three times.
7. Update capacity evidence and evaluate whether an ADR 0018/0019 review is triggered.

## Task Graph

```text
TASK-0010 harness → isolated runtime evidence → architecture decision
```

The sequence is intentionally serial because architecture conclusions depend on runtime results.

## Testing Strategy

`k6 inspect` validates script/options. Smoke validates connectivity. Each profile has status/shape checks and a custom failure rate. Existing backend tests prove no runtime regression because the diff is test/docs only. Runtime validation includes post-run invariant queries.

## Verification Strategy

```bash
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
k6 inspect load-tests/k6/neon-arsenal.js
k6 run load-tests/k6/neon-arsenal.js
```

AC-01–04 map to harness inspection/runtime; AC-05–06 to procedure/template review; AC-07 to subsequent controlled CI run artifacts; AC-08 to diff and existing CI.

## Risks

- Load against the public demo could disrupt users or mutate durable state. Mitigation: localhost default, explicit write gate and isolated-environment procedure.
- Payment replay fixture not pre-warmed could call PayPal. Mitigation: setup preflights `paypalOrderId` and aborts before payment traffic; there is no capture profile.
- Provisional thresholds could be misquoted as SLOs. Mitigation: spec/docs label them guardrails and require environment-qualified reports.
- k6-only results could misdiagnose the bottleneck. Mitigation: correlated API/PostgreSQL evidence is mandatory.

## Dependencies

Successful controlled CI workflow artifacts are required for AC-07. PayPal credentials and valid-event load are neither required nor authorized; payment replay uses a completed local fixture on a no-egress container network.

## Stop Conditions

- Target is the public demo or contains non-disposable user data.
- A run would call OrdersCapture or accept unverified success webhooks.
- Credentials would be committed or copied into artifacts.
- A request adds Redis/Kafka/SQS/AWS before a measured trigger and ADR review.

## Definition of Done

Enablement is reviewed and inspects successfully; then all five profiles run in controlled CI, three equivalent repetitions support every published claim, resource and invariant evidence is attached, and #55 receives the qualified report. The enablement PR alone does not complete AC-07.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → EVIDENCE
```

- External tracker: `#55` (optional)
- Specification: `SPEC-0009` v3
- Plan: `PLAN-0006` v3
- Tasks: `TASK-0010` v3
- PR: pending
- Evidence: pending isolated runtime

## Change History

- `v3` — Replaced the missing external environment dependency with a controlled, production-image CI topology and deferred capacity claims to subsequent runs — 2026-09-09
- `v2` — Migrated validation commands, baseline and traceability to the direct-agent documentation contract — 2026-09-08
- `v1` — Ready plan for SPEC-0009 — 2026-09-07
