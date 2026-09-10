# AI agent guidance

This directory contains the repository-native operating contract for human-directed AI-assisted development.

## Start here

Use this order:

1. `AGENTS.md` — global engineering and domain guardrails.
2. `docs/agents/harness.md` — canonical execution protocol.
3. The named Specification, ADR/invariant, Plan, and Task for the work.
4. The owning code, schema/migrations, closest tests, and provider/runbook documentation required by the risk.

Do not read every file in this directory by default. The harness defines progressive context loading.

## Canonical documents

- [`harness.md`](harness.md) — entry modes, authority resolution, context budget, execution loop, tool contract, evaluation, handoff, portability, and stop conditions.
- [`verification.md`](verification.md) — deterministic repository verification entrypoint and drift policy.
- [`roles.md`](roles.md) — optional review lenses selected by risk; not separate mandatory agents.
- [`decision-policy.md`](decision-policy.md) — human gates and bounded autonomy.
- [`context-policy.md`](context-policy.md) — additional context-loading guidance when a task needs it.
- [`plan-contract.md`](plan-contract.md) and [`task-contract.md`](task-contract.md) — repository artifact contracts.
- [`handoff-template.md`](handoff-template.md) — use only when work is being handed to another person or agent.

Provider adapters such as `.cursor/rules/` must stay thin and cannot redefine these contracts.

## Verification

The canonical deterministic repository check is:

```bash
python scripts/verify.py
```

Task-specific tests and checks remain authoritative for product behavior. A green repository verification run proves the agent/documentation contract, not application correctness by itself.

## Working model

The repository is sequential by default. Parallel work is allowed only for dependency-independent Tasks with disjoint write scopes and no shared invariant/schema/generated-artifact mutation.

GitHub Issues are optional coordination context. Material behavior is authorized by repository Specifications and the artifact chain defined by the harness.

The objective is correctness, bounded context, small diffs, explicit evidence, and useful Senior Backend engineering judgment—not agent infrastructure as a product.
