# Agent Execution Protocol

## State machine

```text
READY
  ↓
PLANNING
  ↓
IMPLEMENTING
  ↓
TESTING
  ↓
REVIEWING
  ↓
VERIFYING
  ├── PASS → DONE
  ├── FAIL → IMPLEMENTING
  └── BLOCKED → HUMAN
```

## READY
Select one eligible GitHub issue. Prefer the highest-priority unblocked issue. Do not start multiple dependent roadmap items concurrently.

## PLANNING
Planner reads the mandatory context, identifies the invariant, affected boundaries, acceptance criteria and verification plan. Output is a compact implementation brief.

If the issue is ambiguous, contradictory or materially larger than documented, transition to `HUMAN` rather than inventing requirements.

## IMPLEMENTING
Primary agent works in an isolated branch/worktree. It changes only files within the issue scope unless a directly required dependency is discovered.

Do not mix unrelated cleanup, dependency upgrades or architectural experiments into the task.

## TESTING
Run the narrowest relevant tests first. Add or update tests that prove the acceptance criteria and important failure/concurrency paths.

A passing test suite does not replace domain reasoning.

## REVIEWING
Review agents inspect the diff, affected architecture and invariants. They should prioritize correctness, security, concurrency, failure modes and unintended scope.

Reviewers should not duplicate the implementation agent's repository exploration.

## VERIFYING
Verification independently executes the agreed checks and confirms the acceptance criteria. If verification fails, return to `IMPLEMENTING` with the exact failure evidence.

## DONE
Only after:
- acceptance criteria are satisfied;
- tests/checks have executed successfully;
- review risks are resolved or explicitly accepted;
- relevant docs/ADRs are updated;
- handoff is complete.

## HUMAN
Use when the decision policy requires approval or when evidence is insufficient. The orchestrator must preserve the blocker and resume from the same task after the decision.

## Agent invocation policy
Do not invoke every role for every issue.

- Simple bug: Primary + Verification.
- API behavior: Primary + Test + Security when relevant + Verification.
- Database/concurrency: Primary + DB/Concurrency + Test + Verification.
- Payment/external integration: Primary + Reliability + Security + Test + Verification.
- Architecture: Planner + Primary + Architecture + Test + Verification.
- Infrastructure: Planner + Primary/Infra + Security + Reliability + Verification.

## Failure budget
If the same task fails verification twice for the same root cause, stop automatic retries and escalate for human review. Do not burn tokens repeating equivalent attempts.

## Parallelism
Parallelize only independent work with disjoint semantic scopes. Never parallelize two agents editing the same file or the same invariant without a defined merge/review strategy.

## Output discipline
Agents should return concise evidence:
- changed files;
- key decision;
- tests/checks run;
- result;
- remaining risk;
- next state.

Do not return long narratives of routine exploration.
