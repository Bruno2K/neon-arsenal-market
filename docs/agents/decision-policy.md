# Agent Decision Policy

## Principle
Agents are autonomous inside an explicit engineering boundary. They optimize for correctness and evidence, not for maximizing changes.

## Autonomous decisions
Agents may decide without human approval when the change is:
- explicitly required by the issue acceptance criteria;
- local to the documented architecture;
- reversible through normal Git workflow;
- backed by existing project conventions;
- covered by appropriate tests or verification;
- not a security or data-loss downgrade.

Examples: implementation details, test structure, small refactors needed by the task, documentation updates, ADRs for decisions already implied by the issue, and bounded performance improvements supported by measurements.

## Human approval required
Stop and request a human decision for:
- destructive or irreversible data migrations without an established rollback strategy;
- changing authentication/authorization guarantees;
- exposing or rotating secrets;
- accepting an unknown external-provider contract as fact;
- changing payment semantics in a way not defined by the issue;
- deleting important data or disabling integrity constraints;
- introducing a new distributed system component solely for anticipated scale;
- changing the architectural boundary from modular monolith to services;
- material backwards-compatibility trade-offs;
- weakening tests, security checks, CI gates or observability to make a task pass;
- contradictory requirements that cannot be resolved from repository evidence.

## Escalation format
When blocked, report:
1. the exact decision needed;
2. options considered;
3. concrete consequences of each option;
4. recommendation;
5. evidence already inspected.

Do not continue speculative implementation while blocked.

## Change-size rule
Prefer the smallest change that establishes the required invariant. A task should not become a vehicle for unrelated cleanup.

If implementation reveals a larger architectural problem, finish the safe local fix if possible and create a follow-up issue for the broader change.

## Review independence
An implementation agent must not mark its own work as fully verified. Verification must inspect the resulting diff and execute the acceptance checks independently.

## Evidence rule
Statements such as "safe", "idempotent", "concurrent", "production-ready" or "tested" require evidence in code, tests, configuration, or executed commands. Never infer these properties from intention alone.
