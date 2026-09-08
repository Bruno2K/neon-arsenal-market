# Task Contract

## Purpose

A Task is the smallest reviewable unit authorized for execution. It translates one Plan node into a bounded outcome without changing the Specification or Plan.

## Required identity

Every file under `docs/tasks/` uses `TASK-<DOMAIN>-<NUMBER>` in both frontmatter and title. The frontmatter records `status`, `version`, Specification and Plan versions, immutable Git baseline, one `owner`, and creation/update dates. `source_issue` is optional external-tracker metadata.

The canonical template is [`../templates/task.md`](../templates/task.md). The factory validator checks the machine-readable structure.

## Lifecycle

```text
Blocked → Ready → InProgress → Done
    ↑          ↘ Blocked
    └──────────── Superseded
```

- `Blocked`: a dependency, decision, or accepted source artifact is missing. A blocked Task may reference a Draft Plan so the missing work is explicit, but it cannot authorize implementation.
- `Ready`: all preconditions hold and the source Plan is `Ready` at the pinned version.
- `InProgress`: the single owner is executing the unchanged Ready contract.
- `Done`: every acceptance criterion is checked and the expected evidence exists.
- `Superseded`: another Task or Plan version replaced the work. This state is terminal.

If the Specification, Plan version, objective, allowed files, or acceptance criteria changes materially after `Ready`, stop execution and create a new Task version or replacement Task through planning. Status-only progress updates do not redefine scope.

## Execution boundary

A Task must define one concrete objective, explicit scope and exclusions, allowed files, preconditions, dependencies, risks, acceptance criteria with evidence classes, an exact verification command, expected evidence, and stop conditions.

The owner may edit only the listed files. If another file becomes necessary, the owner stops and returns the Task to planning. Each Task has one owner at a time; reviewers report findings without silently expanding or rewriting its contract.

Dependencies use canonical Task IDs or `None`. A Task becomes `Ready` only after its dependencies are `Done`. The repository validator enforces reference integrity, ordering, and acyclicity; an agent selects work by reading the validated graph directly.

## Verification and closure

The verification command must be executable from the repository root. Evidence records the exact result rather than a claim of success. A Task can become `Done` only when all acceptance criteria are checked, the command succeeds, the diff stays within `Allowed Files`, and the traceability chain is recoverable:

`SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY`

## Version policy

Start at version 1 and increment the integer when any machine-readable field or contract section changes. Preserve prior decisions in `Change History`. Never reuse a version number for different content.
