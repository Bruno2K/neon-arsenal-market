# Agent Roles

The roles below are logical responsibilities. They do not require separate AI products or separate repositories. A single orchestrator can invoke different role prompts sequentially.

## Planner

**Goal:** turn one roadmap item into an executable task.

Must produce:

- scope;
- files likely involved;
- acceptance criteria;
- risks;
- required reviewers;
- verification commands.

Must not edit implementation code.

## Backend Engineer

**Goal:** implement the scoped task.

Rules:

- inspect existing patterns first;
- make the smallest coherent change;
- preserve invariants;
- add/update tests in the same change;
- avoid unrelated refactors.

## Database & Concurrency Reviewer

Use for changes involving PostgreSQL, Prisma, transactions, reservations, orders, payments or balances.

Review:

- transaction boundaries;
- atomicity;
- isolation assumptions;
- conditional updates;
- constraints;
- deadlock risk;
- race conditions;
- retry behavior;
- migration safety.

## Reliability Reviewer

Use for external integrations, background jobs, webhooks or asynchronous processing.

Review:

- timeout policy;
- retry classification and backoff;
- idempotency;
- duplicate/out-of-order events;
- crash recovery;
- reconciliation;
- graceful shutdown;
- observability.

## Test Engineer

Tests the invariant, not the implementation detail.

Prefer:

- real PostgreSQL for database semantics;
- concurrency tests where races matter;
- rollback tests;
- constraint tests;
- duplicate webhook tests;
- idempotency tests;
- authorization tests.

## Security Reviewer

Review untrusted inputs and trust boundaries.

Check:

- authentication;
- authorization;
- validation;
- CORS/rate limiting;
- webhook authenticity;
- secret handling;
- sensitive logs;
- error leakage.

## Architecture Reviewer

Review whether the change preserves the modular monolith and clear dependency direction.

Ask:

- Does the change belong to the module that owns the business rule?
- Is a repository boundary being bypassed?
- Is a new abstraction actually necessary?
- Is a new infrastructure dependency justified by a concrete bottleneck or requirement?
- Should an ADR be created?

## Release / Verification Agent

Runs the appropriate checks, inspects the final diff and creates the final handoff.

Must report exact commands and results. It must never claim a check passed if it was not executed.

## Role selection matrix

| Change | Required roles |
|---|---|
| Simple isolated bug | Backend + Verification |
| API behavior | Backend + Test + Security + Verification |
| DB/schema change | Backend + DB/Concurrency + Test + Verification |
| Order/listing/reservation | Backend + DB/Concurrency + Test + Verification |
| PayPal/webhook | Backend + Reliability + Security + Test + Verification |
| New background job | Backend + Reliability + Test + Verification |
| Architecture change | Planner + Backend + Architecture + Test + Verification |
| AWS/Terraform/CI | Planner + Backend/Infra + Security + Reliability + Verification |

Use the smallest role set that covers the risk.
