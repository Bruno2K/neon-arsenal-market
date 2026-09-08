# Direct Agent Harness

## Purpose

This repository is the agent harness. Any coding agent with repository access can work safely by reading the same durable artifacts and running the same deterministic checks. No agent vendor, GitHub Issue, prompt generator, model API, or parent orchestrator is required.

## Entry modes

An agent enters through one of four explicit modes:

1. **Execute a Task** — the user names a `TASK-*`; execute only when it is `Ready` or continue it when `InProgress`.
2. **Continue a Plan** — the user names a `PLAN-*`; identify the next declared Task whose dependencies are `Done`.
3. **Shape requested work** — the user describes a problem; apply the materiality rule and create or update the required Specification, Plan, and Task before implementation.
4. **Choose next work** — the user says `next`; validate artifacts and inspect repository Tasks directly. Execute one unambiguously eligible `Ready` Task. If several materially different Tasks are eligible and repository priorities do not decide between them, ask the human to choose. If none is eligible, report that fact instead of consulting GitHub automatically.

An external Issue may be supplied in any mode as context. It never replaces repository authority.

## Artifact resolution

Resolve authority in this order for material work:

```text
Accepted SPEC → Ready PLAN → Ready/InProgress TASK → code and tests → verification evidence
```

- Specification decides required behavior and acceptance.
- ADR and invariant catalogs decide durable architecture and correctness constraints.
- Plan decides implementation strategy and graph structure.
- Task decides the bounded objective, owner, allowed files, dependencies, and verification command.
- Code describes current executable behavior; disagreement with an authoritative artifact is a defect to resolve.

Never manufacture a missing link just to begin coding. Small reversible work may be Task-only when the materiality rule permits it.

## Bootstrap

For an executable Task:

1. Read `AGENTS.md`.
2. Read the named Task and its source Plan and Specification.
3. Read only the architecture, invariant, role, provider, and operational documents referenced by those artifacts or implicated by the risk.
4. Search for the owning implementation and closest tests before opening broad directories.
5. Run `python scripts/ai-factory/validate.py` before broad edits when artifact state may have changed.
6. Confirm Task status, source versions, dependencies, baseline, and allowed-file boundary.

Do not load every document by default.

## Context budget

Use progressive disclosure:

- Tier 0: `AGENTS.md` and the named artifact.
- Tier 1: its direct source artifacts, owning code, and closest tests.
- Tier 2: affected architecture, invariants, security, reliability, provider, or operational documents.
- Tier 3: repository-wide inspection only for broad architecture work or unresolved conflicting evidence.

Stop expanding context when the invariant, required behavior, owner files, proof, and verification command are known. Summaries and handoffs are navigation aids, not authority.

## Execution loop

```text
RESOLVE → VALIDATE → PLAN → IMPLEMENT → TEST → REVIEW → VERIFY → RECORD
```

- **Resolve:** bind work to the authoritative artifact and exact versions.
- **Validate:** confirm graph eligibility, preconditions, and baseline assumptions.
- **Plan:** state a concise sequence and failure model proportional to risk.
- **Implement:** make the smallest coherent change within allowed files.
- **Test:** prove acceptance criteria and relevant failure/invariant behavior.
- **Review:** inspect the diff using the selected role lenses.
- **Verify:** run the exact Task command plus broader checks justified by risk.
- **Record:** update status and durable verification/handoff evidence truthfully.

A failed check returns to implementation with the exact evidence. Two failures from the same unresolved root cause stop the loop for human direction.

## Role lenses

Roles in `docs/agents/roles.md` are review perspectives, not mandatory processes or separate agents. Select the minimum set required by the risk. A single agent may apply them sequentially; genuinely independent work may use separate agents when the environment supports it.

Verification must remain adversarial to the implementation claim. The same agent may verify, but it must inspect acceptance criteria, invariants, failure paths, and the final diff rather than merely summarize its own work.

## Parallelism

Sequential execution is the default. Parallel work is allowed only when Tasks are dependency-independent, allowed files are disjoint, and they do not mutate the same invariant, contract, schema state, or generated artifact. Each Task keeps one owner and produces its own evidence.

The static graph validator proves reference and lifecycle ordering. It does not prove semantic independence; that judgment remains in the Plan and review.

## Evidence and handoff

Completion records:

- artifact IDs and exact versions;
- files changed;
- invariants and contracts affected;
- exact commands and results;
- acceptance mapping;
- unresolved risks and unverified surfaces;
- next eligible Task, when known.

Use `docs/agents/handoff-template.md`. Never claim a check ran when it did not, and never treat a chat summary as durable evidence.

## Portability

The canonical harness uses Markdown, Git, repository code/tests, and dependency-free validation. Provider-specific rules such as `.cursor/rules/` adapt the same contract but cannot override `AGENTS.md`, Specifications, ADRs, invariants, Plans, or Tasks.

Agents may be invoked interactively in Codex, Cursor, or another repository-capable environment. The harness does not call an LLM, own tokens, store credentials, schedule work, or require network access.

## Legacy compatibility

The existing `scripts/orchestrator/` command and its shims are deprecated adapters during migration. They may still be invoked only when a human explicitly requests the legacy path. Normal `next`, feature, bug, Specification, Plan, and Task requests follow this direct harness.

External Issues remain optional references for coordination and historical lookup.

## Stop conditions

Stop and request human direction when authority conflicts materially, required behavior is undefined, a destructive or security-sensitive decision lacks approval, a Task would exceed allowed files, source artifact versions drift, or multiple eligible Tasks represent materially different priorities that the repository does not resolve.
