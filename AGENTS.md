# AGENTS.md — Neon Arsenal Market

## Purpose

This file defines the development rules for AI coding agents working on Neon Arsenal Market.

The repository is a **backend-first portfolio project** intended to demonstrate Senior Backend Engineer capabilities: domain modeling, PostgreSQL, transactions, concurrency, idempotency, payment workflows, reliability, observability, cloud architecture, testing, and explicit technical trade-offs.

The goal is not to maximize feature count. Every change should improve the project's engineering evidence and production-readiness.

## North Star

> A backend engineer who can design reliable systems, reason about consistency and failure modes, make pragmatic trade-offs, operate services, and clearly explain technical decisions.

## Project Priorities

Work should generally follow this order:

1. Correctness and data consistency
2. Security
3. Reliability and failure handling
4. Testability
5. Observability
6. Performance and scalability
7. Maintainability and architecture
8. Developer experience
9. New features

Do not add complexity merely to make the project look more sophisticated.

## Before Changing Code

1. Read the relevant existing module, service, repository, schema, migration, and tests.
2. Understand the current domain rules before proposing an abstraction.
3. Search the repository for existing implementations before creating new utilities, types, middleware, or patterns.
4. Check whether the requested change affects transaction boundaries, authorization, money, inventory state, payments, or external integrations.
5. Prefer the smallest coherent change that solves the problem.
6. Do not silently change business behavior while performing refactors.

## Architecture

The backend is a modular monolith organized by business domain.

Expected high-level flow:

```text
HTTP Controller → Application/Domain Service → Repository → PostgreSQL
```

Shared infrastructure belongs under `server/src/shared/`.
Business behavior belongs under the appropriate module in `server/src/modules/`.

Current domain modules include:

- auth
- users
- sellers
- products
- listings
- orders
- payments
- commissions
- reviews
- admin

Do not introduce microservices unless a concrete requirement demonstrates that the modular monolith can no longer satisfy the requirement. Architectural complexity must have a measurable reason.

### Repository boundaries

Respect repository abstractions where they exist. Do not mix direct Prisma access into application services without a clear reason.

When modifying an existing service, first determine whether the database operation belongs in its repository. If the current architecture is inconsistent, prefer a small refactor that makes the boundary clearer rather than adding another inconsistency.

## Database and Transactions

PostgreSQL is the source of truth for transactional business state.

Be especially careful with:

- listing ownership and availability
- order creation
- reservations
- payment confirmation
- seller balances
- commissions
- concurrent updates

Any workflow that changes multiple pieces of related business state should explicitly consider transaction boundaries.

Never assume that a read followed by a write is safe under concurrency.

Prefer atomic conditional updates, database constraints, and transactions when correctness depends on them.

### Money

Never use JavaScript floating-point arithmetic for monetary business rules when exact decimal semantics are required.

Preserve the project's use of Prisma/PostgreSQL decimal types and avoid introducing `number` calculations that can create rounding errors.

### Schema changes

For database changes:

1. Update the Prisma schema.
2. Create a migration.
3. Update seed/test data when necessary.
4. Update affected application code.
5. Add or update tests for the new invariant.
6. Verify migration behavior and rollback implications when relevant.

Do not modify an existing migration that may already have been applied. Create a new migration instead.

## Order and Inventory Invariants

Listings represent unique items.

The intended lifecycle is:

```text
ACTIVE → RESERVED → SOLD
       ↘ CANCELED
```

Reservation must protect against two buyers successfully acquiring the same unique listing.

Reservation expiration must be safe against races with payment confirmation.

When working on orders or listings, explicitly reason about:

- concurrent buyers
- transaction isolation
- conditional state transitions
- reservation expiration
- retries
- process crashes
- duplicate requests
- payment arriving after expiration

If a change modifies one of these invariants, add a regression or concurrency test whenever practical.

## Payments and Webhooks

PayPal is an external system and must be treated as unreliable from the application's perspective.

Webhook processing must be designed around:

- duplicate delivery
- out-of-order delivery
- retries
- delayed delivery
- local database failures
- application crashes
- reconciliation between external and internal state

Payment confirmation must be idempotent.

Never make a webhook handler assume that it will execute exactly once.

Never mark an order or listing as paid merely because a client claims that payment succeeded.

Validate webhook authenticity according to the provider's supported mechanism before trusting the event.

## Idempotency

Identify whether an operation is safe to retry before implementing retries.

Operations that create orders, confirm payments, publish events, or trigger external side effects should be evaluated for idempotency.

When idempotency state is required, persist it in a durable store rather than relying only on process memory.

For every retryable operation, answer:

1. What happens if the request is repeated?
2. What happens if two identical requests arrive concurrently?
3. What happens if the process crashes after the external side effect but before the local update?
4. How is the operation reconciled?

## External Integrations

Treat PayPal, Resend, and other external providers as failure boundaries.

Use explicit timeouts where supported.

Do not retry blindly. Retries must have:

- a bounded attempt count
- appropriate backoff
- a clear classification of retryable failures
- idempotency protection when side effects are involved

Do not put long-running external operations inside database transactions unless there is a strong, documented reason.

## API and Validation

Keep API contracts explicit.

- Validate untrusted input with Zod or the project's established validation mechanism.
- Preserve authentication and authorization checks.
- Return appropriate HTTP semantics.
- Avoid leaking internal errors, stack traces, credentials, tokens, or sensitive provider data.
- Preserve request/correlation IDs in logs and error paths.
- Keep OpenAPI documentation aligned with public API behavior.

Do not weaken rate limiting, CORS, authentication, authorization, or validation to make tests or development easier.

## Security

Assume all client input and external callbacks are untrusted.

Never commit:

- API keys
- passwords
- JWT secrets
- PayPal credentials
- database credentials
- private tokens
- `.env` files containing secrets

Use environment variables and the existing configuration mechanism.

Avoid logging credentials, access tokens, refresh tokens, passwords, payment secrets, or unnecessary personal data.

## Testing

Tests are part of the implementation, not an optional cleanup step.

Prefer tests that prove business invariants over tests that merely increase line coverage.

Prioritize:

- unit tests for domain/application rules
- integration tests with a real PostgreSQL instance where database behavior matters
- transaction rollback tests
- database constraint tests
- concurrent reservation tests
- duplicate webhook tests
- idempotency tests
- expiration × payment race-condition tests
- authorization tests

When changing behavior, update or add the closest relevant test in the same change.

Do not replace integration behavior with mocks when the behavior being tested depends on PostgreSQL transactions, locking, constraints, or isolation semantics.

## Observability

Future production-oriented work should move toward:

- structured logs
- request/correlation IDs
- OpenTelemetry tracing
- useful application metrics
- health and readiness checks

Important business signals include:

- order creation latency and failures
- payment confirmation latency and failures
- duplicate webhooks
- expired reservations
- reservation conflicts
- database latency/errors
- external provider failures

Observability must not expose secrets or sensitive data.

## Performance and Scalability

Do not optimize based on intuition alone when the change concerns a database hot path or high-volume operation.

For performance work, prefer evidence such as:

- query plans
- `EXPLAIN ANALYZE`
- benchmarks
- request latency measurements
- database metrics
- identified hot paths

When proposing scaling changes, explain the bottleneck first.

Do not introduce Redis, Kafka, RabbitMQ, SQS, caching, or asynchronous processing simply because they are technologies associated with Senior/Staff engineering. Use them when they solve a demonstrated problem.

## Cloud Direction

The intended production-oriented target architecture is:

```text
ECS/Fargate
    ↓
RDS PostgreSQL
    ↓
Secrets Manager
    ↓
CloudWatch / OpenTelemetry
```

Infrastructure-as-code should use Terraform when introduced.

Cloud changes should document cost, reliability, security, and operational trade-offs.

## Documentation

Important architectural decisions should be documented as ADRs.

The flagship project should progressively include:

- Architecture Overview
- C4 context/container diagrams
- ADRs
- Threat Model
- Failure Modes
- Scaling Path
- Runbook
- OpenAPI documentation
- README updates

Documentation should explain **why**, not merely restate **what** the code does.

## AI Agent Workflow

For every non-trivial task, follow this sequence:

### 1. Understand

- Read the relevant code.
- Identify business invariants.
- Identify dependencies and side effects.
- Identify failure modes.

### 2. Plan

Before editing, state a concise implementation plan internally or in the task context.

For changes involving concurrency, payments, transactions, or infrastructure, explicitly identify the consistency and failure model.

### 3. Implement

- Make the smallest coherent change.
- Reuse established project conventions.
- Avoid unrelated refactors.
- Keep types explicit.
- Preserve backward compatibility unless the task explicitly requires a breaking change.

### 4. Verify

Run the most relevant checks available:

- type checking
- linting
- unit tests
- integration tests
- build
- migration validation

If a check cannot be run, say so instead of claiming success.

### 5. Review

Before finishing, inspect the diff and ask:

- Did I introduce a race condition?
- Did I weaken an invariant?
- Is this operation retry-safe?
- Could a process crash leave inconsistent state?
- Did I introduce an N+1 query?
- Did I leak sensitive information?
- Is the abstraction actually necessary?
- Is documentation now inaccurate?
- Does the change improve the evidence of Senior Backend engineering?

## Rules for AI-Generated Code

AI agents must not:

- invent APIs, environment variables, database columns, provider behavior, or configuration that does not exist
- claim that tests passed when they were not executed
- silently delete or rewrite unrelated code
- introduce dependencies without checking whether an existing dependency already solves the problem
- bypass authentication or authorization for convenience
- disable tests or lint rules to make a change pass
- catch and ignore errors without an explicit reason
- use `any` to bypass TypeScript errors unless there is a documented, unavoidable boundary
- add speculative abstractions for hypothetical future requirements
- convert synchronous workflows to asynchronous ones without analyzing consistency and failure semantics

When uncertain, inspect the repository and existing documentation before making assumptions.

## Definition of Done for Significant Backend Changes

A significant change is complete only when the implementation and documentation can support an interview discussion about:

- the problem being solved
- the chosen architecture
- transaction boundaries
- consistency guarantees
- concurrency behavior
- retry and idempotency semantics
- failure modes
- observability
- testing strategy
- scalability limits
- alternatives and trade-offs

The project should demonstrate engineering judgment, not technology collecting.

## Roadmap Alignment

The main roadmap for this project prioritizes:

### P0 — Flagship correctness

- reservation lifecycle and expiration
- reliable PayPal webhook handling
- order/payment idempotency
- concurrency and race-condition tests
- payment reconciliation

### P1 — Production maturity

- PostgreSQL integration testing
- concurrency/rollback/constraint coverage
- OpenTelemetry and tracing
- business/application metrics
- timeouts and explicit retry policies
- graceful shutdown
- benchmark and query analysis

### P2 — Cloud and architecture

- production Docker configuration
- CI/CD
- AWS deployment
- Secrets Manager
- centralized logs
- health/readiness
- Terraform
- architecture documentation

Do not start a lower-priority initiative while a higher-priority correctness issue is known and unresolved, unless explicitly requested.

P-back (backend control plane, not application architecture): `docs/backend-sprint.md`. Next activity: `python3 scripts/p-back/next.py`. Do not implement AWS/Terraform until that catalog reaches C2 and C1 selected AWS.

P-front (frontend control plane, `src/` only): `docs/frontend-sprint.md`. Next activity: `python3 scripts/p-front/next.py`. Unqualified `next` on a backend agent means P-back only.
