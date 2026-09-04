# Agent Context Policy

## Goal
Give each agent the minimum context required to make a correct decision. Context is a budget, not a completeness contest.

## Mandatory reading order
1. `AGENTS.md`
2. `docs/agents/README.md`
3. The role file or role section relevant to the task
4. The specific architecture/invariant document named by the task
5. The GitHub issue
6. Directly relevant source files
7. Relevant tests, schema and migrations
8. ADRs or operational docs only when the task touches those concerns

Do not read the entire repository unless the task is explicitly an architecture audit.

## Context expansion rule
Start narrow. Expand only when one of these occurs:
- an imported symbol changes the behavior under investigation;
- a database relation/constraint is relevant;
- a test fixture hides an invariant;
- configuration changes the behavior;
- an external provider contract is involved;
- documentation and code disagree.

When expanding, record why the additional file was necessary in the handoff.

## Search before opening
Use filename/symbol/term search before opening large files. Prefer targeted ranges over complete files when possible.

## Token-efficiency rules
- Never ask multiple agents to independently rediscover the same architecture.
- Planner produces a compact implementation brief; downstream agents consume it.
- Reviewers inspect the diff and affected paths first, not the whole repository.
- Verification starts with the narrowest relevant command and expands only after failure or acceptance criteria require it.
- Handoffs contain decisions and evidence, not a transcript of exploration.
- Do not paste large source files into agent prompts when repository access is available.
- Do not repeat stable project rules in every task prompt; point to `AGENTS.md` and this policy.

## Context tiers
### Tier 0 — always
`AGENTS.md`, `docs/agents/README.md`, GitHub issue.

### Tier 1 — task-local
Relevant role, architecture, invariants, source, tests, schema/migrations.

### Tier 2 — cross-cutting
Security, reliability, observability, ADRs, deployment docs.

### Tier 3 — repository-wide
Only for architecture changes, broad audits, or when local evidence cannot establish correctness.

## Stop conditions
An agent must stop expanding context when it can answer:
1. What invariant must remain true?
2. What exact behavior must change?
3. Which files own that behavior?
4. Which tests prove it?
5. What verification command proves acceptance?

If those answers are known, implement or review instead of continuing to explore.

## Handoff compression
Every handoff should fit comfortably in a short message and contain:
- task/issue;
- files changed or inspected;
- invariant protected;
- decision made;
- verification performed;
- unresolved risk;
- next action.

The canonical format is `docs/agents/handoff-template.md`.
