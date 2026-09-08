# ADR 0021 — Keep AI workflow subordinate to backend engineering evidence

## Status

Accepted

## Context

Neon Arsenal is a backend-first portfolio project intended to support a Senior Backend Engineer interview, with Mercado Livre as the reference environment. The repository already has Specifications, Plans, Tasks, a dependency graph, agent instructions, and deterministic validation. Extending that system into an autonomous software factory would shift effort away from the product qualities the portfolio must demonstrate.

Public Mercado Livre engineering material emphasizes standardized developer experience, reliability, observability, performance evidence, safe delivery, and human judgment over technology for its own sake. AI-assisted work is useful here only when it improves context access, reviewability, and verification.

## Decision

Backend engineering evidence is the primary outcome. AI agents are human-directed implementation and review tools.

Material work uses the focused chain:

```text
SPEC → PLAN → TASK(S) → PR → EVIDENCE
```

Small, reversible work may use the normal PR workflow with proportionate tests and evidence. A Task graph is useful only when multiple work units have real ordering or independence. Evidence may be contained in tests, CI, the PR, or a durable verification note; separate Evaluation and Memory phases are not required.

The deterministic checker is named and scoped as documentation-contract validation. It does not select work, invoke agents, evaluate code quality, or maintain agent memory.

## Consequences

- Interview discussion stays centered on transactions, concurrency, idempotency, payments, reliability, observability, performance, security, and trade-offs.
- Agent usage remains explainable: scoped context, explicit acceptance, human review, and executed evidence.
- Documentation scales with risk instead of requiring the full artifact set for trivial work.
- Historical artifacts keep their original chain and remain auditable in Git.
- There is no claim that this workflow reproduces Mercado Livre's private internal process.

## Supersedes

This ADR narrows the active workflow established by ADR 0020. ADR 0020 remains the decision that removed mandatory orchestration; this ADR defines the portfolio-oriented operating target after that removal.

## Rejected alternatives

- Continue implementing Evaluation and Memory subsystems: additional process without evidence that it improves the portfolio.
- Remove all agent guidance and Specs: loses useful controls for high-risk business behavior.
- Imitate Mercado Livre's microservice count or internal platform: scale theater would obscure pragmatic judgment in a single-project portfolio.
