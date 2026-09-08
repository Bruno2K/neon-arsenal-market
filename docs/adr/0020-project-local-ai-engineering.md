# ADR 0020 — Project-local artifacts replace mandatory orchestration

## Status

Accepted

## Context

Neon Arsenal already stores Specifications, Plans, Tasks, verification, evaluation, and memory beside the code. Requiring a GitHub Issue and a Python runtime that selects work and constructs agent prompts duplicates authority, couples execution to one workflow, and consumes effort without improving product correctness.

The useful engineering system is SDD plus a validated dependency graph and a lightweight agent harness. Those concerns do not require an LLM-owning orchestration service.

## Decision

The repository is the system of record for AI-assisted engineering. Material work begins at an accepted Specification and continues through Plans and Tasks. External trackers are optional references. Agents read the repository contracts directly, and deterministic tooling validates structure and graph integrity without selecting work or invoking an LLM.

The existing orchestrator will be retired in later reviewable changes after the direct agent harness is documented. No separate orchestrator repository will be created.

## Consequences

- Neon documentation remains in Neon and evolves with its code.
- The workflow works with Codex, Cursor, or another repository-capable agent.
- Token usage is controlled by context-loading rules and bounded Tasks, not by a proxy runtime.
- GitHub Issues can still be used for human coordination without becoming an authority dependency.
- Static validation cannot judge whether a decomposition is semantically good; agent review and verification remain necessary.

## Rejected alternatives

- Extract the orchestrator to a generic repository: preserves a component whose responsibility is no longer necessary.
- Make the orchestrator an LLM gateway: adds vendor, API, secret, and token-accounting coupling.
- Remove all engineering artifacts: loses the durable context and verification benefits already achieved.
