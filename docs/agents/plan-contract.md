# Plan Contract

## Purpose

A Plan converts one Specification version into a bounded implementation strategy. A Draft may explore a Proposed Specification for review, but only an Accepted source at the exact declared version permits transition to `Ready`. The Plan records current evidence, affected boundaries, ordering, risks, tests, verification, dependencies, and stop conditions before an executor changes product behavior.

The canonical structure is `docs/templates/plan.md`. Repository Plans live directly under `docs/plans/` while artifact discovery remains non-recursive.

## Authority boundary

The Specification defines what must become true. A Plan defines how the repository can make it true. A Plan cannot weaken acceptance criteria, invent business behavior, override an ADR or invariant, or treat current implementation defects as requirements.

If implementation evidence conflicts with the source Specification, the Planner records the conflict and stops. The conflict is resolved in the authoritative artifact before the Plan becomes `Ready`.

## Identity and lifecycle

Every Plan has a stable `PLAN-*` ID in frontmatter and title. Required metadata is `id`, `status`, `version`, `source_spec`, `source_spec_version`, `baseline_revision`, `owner`, `created`, and `updated`. `baseline_revision` is the exact 40-character Git commit inspected by the Planner.

Allowed transitions are:

```text
Draft → Ready
Draft → Superseded
Ready → Superseded
```

`Draft` permits analysis and review but does not authorize execution. `Ready` means hard dependencies and blocking decisions are resolved, the source Specification is `Accepted`, and its version matches `source_spec_version`. `Superseded` is terminal for that Plan version.

Draft revisions update the same file and increment `version`; Git preserves their review history. Once a Plan becomes `Ready`, its content and version are immutable except for transition to `Superseded`. Material replacement receives a new globally unique `PLAN-*` ID and may name its predecessor in Change History. This matches repository uniqueness validation while retaining ready artifacts as durable evidence.

If an accepted Specification changes materially, its downstream Plan cannot remain executable. Supersede it and publish a replacement with a new Plan ID bound to the new Specification version.

## Reproducibility

Another Planner given the same Specification and `baseline_revision` should recover the same material boundaries, invariants, hard dependencies, and acceptance evidence. File-level sequencing may differ when alternatives preserve those constraints; such choices must be recorded when they change risk or verification.

Current-state claims must cite repository evidence. Unknown paths are candidates, not promised files. External behavior that cannot be verified is a dependency or stop condition.

## Task graph rules

The graph is directed and acyclic. Each edge means the successor cannot begin until the predecessor's output and verification are available. Sequential execution is the default.

Parallel nodes are allowed only when they have disjoint write scopes, do not mutate the same invariant or database state, and neither consumes the other's output. One task has one owner at a time.

F3.1 records stable Plan-side node labels and dependency edges. F3.2 owns the canonical Task identity, lifecycle, metadata, and dependency representation. Until that contract is accepted, Plan nodes are decomposition labels rather than executable Task artifacts.

## Completeness rules

A reviewable Plan records its source Specification ID and exact version, relevant current state and evidence, candidate files and architectural boundaries, database and transaction implications, ordered work and task dependencies, acceptance-criterion-to-test mapping, exact verification commands and environment needs, risks, mitigations, hard dependencies, stop conditions, Definition of Done, and full artifact traceability.

The Planner does not implement. Discovery that changes accepted behavior, architecture, compatibility, security, payment, or consistency returns the work to Specification or HUMAN review.

## Validation

`python scripts/ai-factory/validate.py` validates Plan identity, metadata, lifecycle values, baseline revision, required sections, source reference format, numeric versions, and canonical traceability. Cross-reference validation rejects a missing source Specification. A `Ready` Plan additionally requires an `Accepted` source at the exact declared version.

Structural validation cannot prove that the decomposition is correct or that a source Specification is substantively accepted. Review and later planner/convergence phases provide that evidence.
