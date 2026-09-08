# Mercado Livre-oriented backend proof of concept

## Positioning

Neon Arsenal is a backend-first marketplace case study for a Senior Backend Engineer interview. It does not attempt to reproduce Mercado Livre's private architecture, processes, traffic, or internal platform. It uses public engineering material as a reference for the kinds of judgment a high-scale commerce platform requires.

AI is part of the development method, not the product claim. Repository-capable agents help inspect, implement, test, and review bounded changes. The portfolio owner remains responsible for requirements, architecture, trade-offs, and acceptance.

## Public reference themes

Mercado Livre's public engineering articles repeatedly emphasize:

- standardized and self-service developer experience through Fury, including CI/CD, deployment choices, monitoring, security, and reproducible environments;
- resilient application primitives such as timeouts, retries, circuit breakers, tracing, metrics, and structured logging;
- logs, metrics, distributed traces, and performance evidence as operational tools;
- proofs of concept, alternatives, reports, and measurements for important architecture decisions;
- focused steps, contextual documentation, and human review in publicly described agent-assisted experiments.

These themes guide the evidence selected for this portfolio; they are not presented as an internal Mercado Livre process specification.

## Three flagship engineering stories

### 1. Concurrent purchase of a unique listing

**Question:** What prevents two buyers from successfully purchasing the same unique item?

**Evidence target:** explicit listing state machine, PostgreSQL transaction boundary, atomic conditional transition, database constraint reasoning, concurrent integration test, reservation expiration versus payment race, and documented trade-offs.

### 2. Reliable payment confirmation

**Question:** What happens when a provider webhook is duplicated, delayed, delivered out of order, or interrupted by a local failure?

**Evidence target:** webhook authenticity, durable idempotency, state-transition protection, crash-window analysis, bounded retry policy, reconciliation path, duplicate-event integration tests, and observable failure signals.

### 3. Operability and evidence-based performance

**Question:** How would an engineer detect, diagnose, and improve a production problem without guessing?

**Evidence target:** structured logs and correlation IDs, OpenTelemetry traces, business and technical metrics, SLOs, health/readiness, query plans, load or benchmark results, capacity assumptions, rollout/rollback reasoning, and cost-versus-reliability trade-offs.

## AI-assisted working agreement

For material behavior, the agent follows:

```text
SPEC → PLAN → TASK(S) → PR → EVIDENCE
```

- The Specification defines behavior and acceptance; the agent cannot invent missing business rules.
- The Plan records architecture, consistency, failure, security, and verification reasoning proportional to risk.
- Tasks are used when bounded execution or real dependencies improve reviewability; graphs are not created for appearance.
- The PR contains the implementation and the evidence actually executed.
- Human review accepts or rejects material trade-offs.

Small, reversible changes use a normal scoped PR with proportionate tests. Documentation volume is not a success metric.

## Interview narrative

The intended explanation is:

> I used coding agents to accelerate repository exploration and bounded implementation, while keeping business rules in versioned Specifications, concurrency and reliability decisions in executable code and ADRs, and acceptance in tests and PR evidence. The agent proposed and implemented; I remained accountable for architecture, failure modes, security, and the final decision.

## Success criteria

The proof of concept succeeds when an interviewer can inspect each flagship story and recover:

1. the business risk;
2. the invariant and failure model;
3. the chosen implementation and alternatives;
4. executable evidence;
5. operational signals;
6. limitations and the next scaling step.

It does not succeed by maximizing the number of artifacts, agents, technologies, or simulated services.

## Public references

- [The technological evolution at Mercado Libre: from the monolith to the multicloud platform](https://medium.com/mercadolibre-tech/the-technological-evolution-at-mercado-libre-fb269776a4e8)
- [For devs, by devs: The story of the Mercado Libre Go toolkit](https://medium.com/mercadolibre-tech/for-devs-by-devs-67a395a03c3f)
- [Enabling OpenTelemetry-based distributed tracing](https://medium.com/mercadolibre-tech/enabling-opentelemetry-based-distributed-tracing-ba276ad2523a)
- [How Kubernetes became the right fit for Mercado Libre's internal developer platform](https://medium.com/mercadolibre-tech/how-kubernetes-became-the-right-fit-for-mercado-libres-internal-developer-platform-fb02df289def)
- [Boosting Store Integration: MCP and agentic IDEs for Mercado Libre listings](https://medium.com/mercadolibre-tech/boosting-store-integration-mcp-and-agentic-ides-for-mercado-libre-listings-6bf616a914f2)
