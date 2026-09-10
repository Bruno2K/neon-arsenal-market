# AI agent guidance

This directory contains the provider-neutral execution contract and the few supporting references that have independent value. A new coding agent should normally need only three layers: `AGENTS.md`, `docs/agents/harness.md`, and its provider adapter (for Cursor, `.cursor/rules/00-agent-operating-system.mdc`).

## Start here

Use this order:

1. `AGENTS.md` — global engineering and domain guardrails.
2. `docs/agents/harness.md` — canonical execution protocol.
3. The provider adapter, when the environment supplies one.
4. The named Specification, ADR/invariant, Plan, and Task for the work.
5. The owning code, schema/migrations, closest tests, and provider/runbook documentation required by the risk.

Do not read every file in this directory by default. The harness defines progressive context loading.

## Canonical procedure

- [`harness.md`](harness.md) — entry modes, authority resolution, context budget, execution loop, tool contract, evaluation, handoff, portability, and stop conditions.

The harness owns agent procedure. Supporting files below do not redefine it.

## Supporting references

- [`verification.md`](verification.md) — deterministic repository verification entrypoint and drift policy.
- [`roles.md`](roles.md) — optional review lenses selected by risk; not separate mandatory agents.
- [`plan-contract.md`](plan-contract.md) and [`task-contract.md`](task-contract.md) — durable lifecycle and validation semantics for repository artifacts.
- [`handoff-template.md`](handoff-template.md) — use only when work is being handed to another person or agent.

The only canonical Specification, Plan, and Task structures are [`../templates/spec.md`](../templates/spec.md), [`../templates/plan.md`](../templates/plan.md), and [`../templates/task.md`](../templates/task.md). Supporting contracts explain semantics; they are not competing templates.

Provider adapters must stay thin and cannot redefine repository authority or the harness.

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
