---
id: PLAN-0006
status: Ready
version: 4
source_spec: SPEC-0009
source_spec_version: 4
baseline_revision: 9f4c60885d8a1c9c11362d1b236c6179b7f787e9
owner: "Neon Arsenal Engineering"
created: 2026-09-07
updated: 2026-09-10
---

# [PLAN-0006] — k6 load testing and capacity evidence

## Status

`Ready`

`Ready` is retained because the documentation contract has no terminal Plan status. Implementation and runtime qualification are complete and recorded below.

## Source

- Specification: `SPEC-0009` v4
- External tracker: `#55` (optional)
- Planning task: performance evidence before infrastructure expansion
- Baseline: `9f4c60885d8a1c9c11362d1b236c6179b7f787e9`

## Current State

The five-profile k6 harness, controlled no-egress CI topology, disposable fixture/invariant gates and synchronized API/PostgreSQL resource capture are implemented. All five profiles have successful isolated runtime evidence. The catalog capacity statement is qualified by three equivalent repetitions on commit `87c73d3ee974d1de92a0bce4c4369bb7be806e1b` using the same frozen API image.

The committed controlled-CI point is a 150-RPS catalog hold for 60 seconds with zero HTTP failures and zero dropped iterations across all three repetitions. This is not Render or production capacity.

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
6. Execute all profiles and repeat each claimed stable point three times.
7. Publish the qualified capacity evidence and evaluate whether an ADR 0018/0019 review is triggered.

All seven steps are complete for the current controlled-CI evidence scope.

## Task Graph

```text
TASK-0010 harness → isolated runtime evidence → architecture decision
```

The sequence is intentionally serial because architecture conclusions depend on runtime results.

## Testing Strategy

`k6 inspect` validates script/options. Smoke validates connectivity. Each profile has status/shape checks and a custom failure rate. Existing backend tests prove no runtime regression because the performance work does not change the application API/schema/deploy contract. Runtime validation includes post-run invariant queries.

## Verification Strategy

```bash
python scripts/docs/validate_contracts.py
python tests/tooling/test_docs_contracts.py
k6 inspect load-tests/k6/neon-arsenal.js
k6 run load-tests/k6/neon-arsenal.js
```

AC-01–04 map to harness inspection/runtime; AC-05–06 to procedure/template review; AC-07 to controlled CI run artifacts; AC-08 remains a standing regression criterion in the Accepted Spec.

## Risks

- Load against the public demo could disrupt users or mutate durable state. Mitigation: localhost default, explicit write gate and isolated-environment procedure.
- Payment replay fixture not pre-warmed could call PayPal. Mitigation: setup preflights `paypalOrderId` and aborts before payment traffic; there is no capture profile.
- Provisional thresholds could be misquoted as SLOs. Mitigation: spec/docs label them guardrails and require environment-qualified reports.
- k6-only results could misdiagnose the bottleneck. Mitigation: correlated API/PostgreSQL evidence is mandatory.
- GitHub-hosted runners vary. Mitigation: claims require three equivalent repetitions and remain explicitly qualified as controlled-CI evidence.

## Dependencies

The required controlled CI workflow artifacts now exist. PayPal credentials and valid-event load are neither required nor authorized; payment replay uses a completed local fixture on a no-egress container network.

## Stop Conditions

- Target is the public demo or contains non-disposable user data.
- A run would call OrdersCapture or accept unverified success webhooks.
- Credentials would be committed or copied into artifacts.
- A request adds Redis/Kafka/SQS/AWS before a measured trigger and ADR review.

## Definition of Done

Enablement is reviewed; all five profiles run in controlled CI; three equivalent repetitions support every published claim; resource and invariant evidence is attached; and the qualified report is committed. These conditions are satisfied for the current scope.

## Traceability

```text
SPEC → PLAN → TASK(S) → PR → EVIDENCE
```

- External tracker: `#55` (optional)
- Specification: `SPEC-0009` v4
- Plan: `PLAN-0006` v4
- Task: `TASK-0010` v4
- Implementation/qualification PRs: `#229`–`#239`
- Successful profile runs: smoke `34401063625`; webhook rejection `34403607329`; orders `34418517461`; payment replay `34420854485`; catalog `34439840030`
- Final report: `docs/performance/load-test-report-2026-09-10-catalog.md`

## Change History

- `v4` — Recorded completion of the implementation/runtime sequence and the three-repetition frozen-image catalog qualification; Plan remains `Ready` per repository contract — 2026-09-10
- `v3` — Replaced the missing external environment dependency with a controlled, production-image CI topology and deferred capacity claims to subsequent runs — 2026-09-09
- `v2` — Migrated validation commands, baseline and traceability to the direct-agent documentation contract — 2026-09-08
- `v1` — Ready plan for SPEC-0009 — 2026-09-07
