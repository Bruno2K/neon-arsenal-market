---
id: SPEC-0001
status: Accepted
version: 1
source_issue: "Factory F2.1 / F2.5"
owner: "AI Engineering Factory"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0001] — Specification System

## Status

`Accepted`

This Specification defines the contract for material Specifications in Neon Arsenal Market. It is itself the reference implementation of the contract established in `docs/templates/spec.md`.

## Problem

Material engineering work currently has requirements distributed across GitHub Issues, architecture documents, ADRs, invariants, and agent instructions. Without a canonical Specification contract, an agent can begin implementation without a durable, independently verifiable statement of what must become true.

## Goal

Establish a repository-native Specification artifact that becomes the authoritative contract for material business behavior and can be consumed by planners, executors, verifiers, and future convergence tooling without requiring the original conversation.

## Actors

- Human product/engineering requester
- AI engineering agent
- Planner
- Implementation agent
- Verification agent
- GitHub Issue/PR workflow
- CI artifact validator

## Scope

- Define the canonical Specification structure and metadata.
- Require stable Specification IDs and lifecycle status.
- Make acceptance criteria independently verifiable.
- Preserve traceability from Issue through downstream factory artifacts.
- Allow future planning, convergence, evaluation, and memory systems to reference the Specification deterministically.

## Non-goals

- Replacing ADRs, the invariant catalog, source code, or tests.
- Implementing a second orchestration system.
- Automatically approving product requirements.
- Making every trivial bug fix require a Specification.
- Introducing new runtime infrastructure or dependencies.

## Business Rules

- `BR-01`: Material changes require an authoritative Specification before implementation.
- `BR-02`: An `Accepted` Specification is the authoritative contract for the business behavior it defines.
- `BR-03`: `Proposed` Specifications may be refined but must not be treated as accepted implementation contracts.
- `BR-04`: `Superseded` Specifications remain historical references and must not silently authorize new implementation.
- `BR-05`: Acceptance criteria describe observable outcomes and identify evidence sufficient for independent verification.
- `BR-06`: A Specification may reference ADRs and invariants but may not silently override them.
- `BR-07`: A material change to an accepted Specification requires downstream Plan/Task artifacts to be re-evaluated.

## Invariants

- `AI-ARTIFACT-001`: Canonical artifact IDs must be unique within their artifact type.
- `AI-ARTIFACT-002`: A material implementation must remain traceable to its authoritative Specification.
- `AI-ARTIFACT-003`: Agent memory cannot override current authoritative requirements, architecture decisions, or executable invariant evidence.

## State Transitions

```text
Proposed → Accepted
Accepted → Superseded
```

`Superseded` is terminal for that Specification version. A replacement Specification receives its own version/identity according to the factory's future revision policy.

## API / Data Contract

Specification frontmatter must contain:

- `id`
- `status`
- `version`
- `source_issue`
- `owner`
- `created`
- `updated`

The title must contain the same canonical `SPEC-*` identifier as the frontmatter.

The document must contain the canonical contract sections in `docs/templates/spec.md`.

## Concurrency Model

Specification editing is not runtime business concurrency. The relevant consistency requirement is artifact consistency: when an accepted Specification changes materially, downstream Plans and Tasks must not continue executing against an obsolete contract.

Future factory tooling must detect stale downstream artifacts through explicit version/reference metadata rather than relying on conversation state.

## Failure Modes

- Missing Specification: material work is blocked before implementation.
- Invalid Specification metadata: CI artifact validation fails.
- Ambiguous acceptance criterion: independent verification cannot establish acceptance; the Specification must be refined.
- Conflicting authoritative artifacts: agent must not invent a requirement and must escalate material ambiguity.
- Accepted Specification changes after planning: downstream planning/execution must be re-evaluated.

## Security

Specifications must not contain secrets, credentials, access tokens, private keys, or unnecessary sensitive personal data.

Security requirements for a material feature belong in the Specification and must be represented by independently verifiable acceptance criteria.

## Observability

Factory tooling should eventually record Specification ID/version in execution, verification, convergence, and evaluation metadata so an execution can be audited without the original conversation.

For this phase, repository validation is the required evidence that the structural contract is valid.

## Backward Compatibility

The Specification system is additive. Existing GitHub Issue → agent → verification → PR workflows remain valid while material changes progressively adopt the Specification contract.

Existing ADRs, invariant documents, code, and tests remain authoritative for their defined concerns.

## Acceptance Criteria

- [ ] `AC-01` — A material Specification has stable `SPEC-*` identity, lifecycle status, version, owner, source issue, and timestamps. **Evidence:** static check
- [ ] `AC-02` — The canonical Specification contains problem, goal, scope, rules, invariants, contracts, failure/security concerns, acceptance criteria, verification strategy, and traceability. **Evidence:** static check
- [ ] `AC-03` — Each material acceptance criterion identifies an evidence class that an independent verifier can inspect. **Evidence:** static check
- [ ] `AC-04` — A Specification's frontmatter ID matches its canonical title ID and its status is one of `Proposed`, `Accepted`, or `Superseded`. **Evidence:** static check
- [ ] `AC-05` — A valid Specification can be referenced by downstream Plan and Task artifacts without depending on the original chat conversation. **Evidence:** integration
- [ ] `AC-06` — The artifact validator rejects malformed Specification metadata and accepts this reference Specification. **Evidence:** static check

## Verification Strategy

- Run `python3 scripts/ai-factory/validate.py`.
- Confirm `SPEC-0001` is discovered under `docs/specs/`.
- Confirm malformed metadata, mismatched title/frontmatter IDs, invalid statuses, and missing evidence-bearing acceptance criteria fail validation.
- In F2.2/F2.3, create Issue ↔ Spec traceability and convert a real Neon Arsenal business flow to this contract.

## Decisions / References

- `docs/architecture/ai-engineering-authority.md`
- `docs/templates/spec.md`
- `AGENTS.md`
- `.cursor/rules/00-agent-operating-system.mdc`

## Traceability

```text
GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

- Issue: `Factory F2.1 / F2.5`
- Spec: `SPEC-0001`
- Plan: pending F3
- Tasks: `F2.1`
- PR: pending
- Verification/Convergence: pending F4
- Evaluation: pending F5
- Memory: pending F6

## Change History

- `v1` — Initial accepted Specification system contract — 2026-09-06
