# Direct Agent Harness

## Purpose

This repository supplies guardrails for human-directed, AI-assisted development. Any coding agent with repository access can read the same durable artifacts and run the same deterministic checks. No agent vendor, GitHub Issue, prompt generator, model API, or parent orchestrator is required. The human owns material requirements, trade-offs, review, and acceptance.

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

Never manufacture a missing link just to begin coding. Small reversible work may use a normal scoped PR with proportionate tests when the materiality rule permits it.

## Bootstrap

For an executable Task:

1. Read `AGENTS.md`.
2. Read the named Task and its source Plan and Specification.
3. Read only the architecture, invariant, role, provider, and operational documents referenced by those artifacts or implicated by the risk.
4. Search for the owning implementation and closest tests before opening broad directories.
5. Run `python scripts/docs/validate_contracts.py` before broad edits when artifact state may have changed.
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
RESOLVE → VALIDATE → PLAN → IMPLEMENT → TEST → REVIEW → VERIFY → EVALUATE → RECORD
```

- **Resolve:** bind work to the authoritative artifact and exact versions.
- **Validate:** confirm graph eligibility, preconditions, and baseline assumptions.
- **Plan:** state a concise sequence and failure model proportional to risk.
- **Implement:** make the smallest coherent change within allowed files.
- **Test:** prove acceptance criteria and relevant failure/invariant behavior.
- **Review:** inspect the diff using the selected role lenses.
- **Verify:** run the exact Task command plus broader checks justified by risk.
- **Evaluate:** decide convergence with deterministic evidence and the material-work rubric.
- **Record:** update status and durable verification/handoff evidence truthfully.

A failed check returns to implementation with the exact evidence. Two failures from the same unresolved root cause stop the loop for human direction.

## Tool contract

Tools are bounded capabilities, not sources of authority. Prefer the repository's named scripts, focused APIs, and structured integrations over open-ended shell commands when they provide the same capability.

For every material tool action, establish:

- the narrow input and intended target;
- the expected output or state change;
- timeout and bounded retry behavior when failure is transient;
- idempotency or duplicate-call behavior when state can change;
- least privilege and any required human approval;
- a useful, preservable error result;
- rollback or another recovery path when practical.

Use read-only discovery before destructive or high-impact calls. A tool must not expand the user's authority, and an MCP server is optional: adopting a protocol is not a substitute for a safe tool contract.

## Role lenses

Roles in `docs/agents/roles.md` are review perspectives, not mandatory processes or separate agents. Select the minimum set required by the risk. A single agent may apply them sequentially; genuinely independent work may use separate agents when the environment supports it.

Verification must remain adversarial to the implementation claim. The same agent may verify, but it must inspect acceptance criteria, invariants, failure paths, and the final diff rather than merely summarize its own work.

## Evaluation contract

Evaluation is a stage of the execution loop, not a mandatory artifact folder. Deterministic evidence comes first: tests, type checking, lint, contract/schema validation, security checks, benchmarks, or runtime evidence selected by risk.

For material work, the final review scores each dimension from 0 to 2:

- specification and acceptance fidelity;
- correctness, invariants, and failure behavior;
- security and governance;
- architecture and scope discipline;
- verification and operational evidence.

The change converges at 8/10 or higher, with no zero in specification fidelity, correctness, or security. A score must cite evidence; it cannot be based on the implementation agent's confidence. A failed evaluation returns to the relevant earlier state, while repeated failure follows the retry budget and human-escalation rule.

## Parallelism

Sequential execution is the default. Parallel work is allowed only when Tasks are dependency-independent, allowed files are disjoint, and they do not mutate the same invariant, contract, schema state, or generated artifact. Each Task keeps one owner and produces its own evidence.

The static graph validator proves reference and lifecycle ordering. It does not prove semantic independence; that judgment remains in the Plan and review.

## State and memory

Execution state is recoverable from the active artifact, branch and diff, current graph state, commands and results, retry count, approvals, and handoff. Keep it compact enough that another agent can resume without replaying the conversation.

Memory is curated, reusable engineering knowledge. Promote a learning only after evidence validates it, and place it in the existing authority that owns it: an ADR for architecture, an invariant or test for correctness, a runbook for operations, or agent guidance for a stable procedure. Record the evidence and review date where staleness matters.

Do not preserve private chain-of-thought, raw exploration, transient errors, or unverified conclusions as project memory. A separate `docs/memory/` subsystem is not required.

## AgentOps evidence

Agent observability is proportional to autonomy and risk. The PR or handoff records the workflow state reached, verification results, retries and their root causes, tool failures that changed the approach, human gates, rollbacks, and unresolved risk. Record duration, model, token, or cost data only when the execution environment exposes them reliably and the data will inform a decision.

Do not build an agent telemetry service for this human-directed repository. If future automation can run unattended, mutate shared environments, or spend material budget, define traces, cost limits, success metrics, and alerting before granting that autonomy.

## Evidence and handoff

Completion evidence records:

- artifact IDs and exact versions;
- files changed;
- invariants and contracts affected;
- exact commands and results;
- acceptance mapping;
- evaluation score and cited findings for material work;
- retry, tool-failure, rollback, and human-gate history when applicable;
- unresolved risks and unverified surfaces;
- next eligible Task, when known.

Use `docs/agents/handoff-template.md` when another person or agent will continue the work. Otherwise, the PR description and executed checks may be sufficient. Never claim a check ran when it did not, and never treat a chat summary as durable evidence.

## Portability

The canonical harness uses Markdown, Git, repository code/tests, and dependency-free validation. Provider-specific rules such as `.cursor/rules/` adapt the same contract but cannot override `AGENTS.md`, Specifications, ADRs, invariants, Plans, or Tasks.

Agents may be invoked interactively in Codex, Cursor, or another repository-capable environment. The harness does not call an LLM, own tokens, store credentials, schedule work, or require network access.

## Removed interfaces

The former `scripts/orchestrator/` runtime, shell wrappers, P-back/P-front shims and catalogs, issue-creation helpers, legacy tests, dedicated docs, and provider rule were removed after this harness became canonical. Git history preserves them if historical inspection is needed; do not recreate compatibility shims.

External Issues remain optional references for coordination and historical lookup.

## Stop conditions

Stop and request human direction when authority conflicts materially, required behavior is undefined, a destructive or security-sensitive decision lacks approval, a Task would exceed allowed files, source artifact versions drift, or multiple eligible Tasks represent materially different priorities that the repository does not resolve.
