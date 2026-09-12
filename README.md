# Neon Arsenal Market

Backend-first marketplace portfolio project for Counter-Strike 2 skins, built to demonstrate Senior Backend Engineering through correctness, financial consistency, failure recovery, operational evidence, and explicit trade-offs.

The product surface is a React/Vite marketplace. The engineering focus is the TypeScript/Express/PostgreSQL backend: unique-item concurrency, reliable PayPal payment and refund workflows, and measurable operations without speculative distributed infrastructure.

## Three engineering stories

### 1. One unique item, two competing buyers

**Problem:** listings are individual items, so two buyers racing for one listing must not both acquire it.

**Invariant:** at most one order owns a valid reservation, and payment can sell the listing only while that same order still owns an unexpired hold.

**Mechanism:** order creation, items, the customer-scoped idempotency claim, and a conditional `ACTIVE → RESERVED` update commit in one PostgreSQL transaction. The reservation records its owner and expiry. Expiration conditionally releases only stale `RESERVED` rows; confirmation conditionally requires `reservedByOrderId = orderId` and a live TTL.

**Evidence:** [`INV-LISTING-EXCLUSIVE-RESERVE`](docs/domain/invariants.md#inv-listing-exclusive-reserve), [`ADR 0001`](docs/adr/0001-in-process-reservation-expiry.md), [`ADR 0003`](docs/adr/0003-order-creation-idempotency.md), the [reservation lifecycle tests](server/src/__tests__/reservation.lifecycle.integration.test.ts), and the [PostgreSQL transaction tests](server/src/__tests__/postgres.transactions.integration.test.ts).

```text
ACTIVE → RESERVED → SOLD
       ↘ CANCELED
```

### 2. Payment is a recoverable workflow, not a PayPal button

```text
Order
  → durable PaymentLink claim
  → PayPal OrdersCreate / OrdersCapture
  → trusted provider state
  → local confirmation transaction
  → listings SOLD + seller ledger/balance + outbox
```

The client cannot declare an order paid. A narrow Payments-owned outbound gateway isolates PayPal mechanics, but application services retain orchestration and PostgreSQL transactions. `APPROVED` is intermediate; only trusted `COMPLETED` state can confirm locally. Provider I/O stays outside critical database transactions.

Duplicate payment requests replay one durable link, duplicate or out-of-order webhooks converge through provider event identity, and webhook authenticity is verified before processing. If remote capture succeeds but the reservation is expired or lost, fulfillment remains rejected: one durable full-refund obligation is reconciled with a stable PayPal request identity. Provider-confirmed completion updates local refund state and appends any required seller compensation instead of rewriting financial history.

**Evidence:** [`ADR 0002`](docs/adr/0002-paypal-webhook-reliability.md), [`ADR 0012`](docs/adr/0012-transactional-outbox.md), [`SPEC-0013`](docs/specs/SPEC-0013-refund-financial-compensation.md), [`ADR 0024`](docs/adr/0024-refund-compensation.md), [`ADR 0025`](docs/adr/0025-paypal-provider-boundary.md), the [payment-link](server/src/__tests__/payment.link.idempotency.integration.test.ts), [webhook](server/src/__tests__/paypal.webhook.integration.test.ts), [refund execution](server/src/__tests__/refund.execution.integration.test.ts), and [refund reconciliation](server/src/__tests__/refund.reconciliation.integration.test.ts) tests, plus the [operator runbook](docs/operations/runbook.md#refund-reconciliation).

### 3. Operations and performance are evidence-bounded

`/health` proves process liveness; `/ready` proves PostgreSQL readiness and rejects traffic during shutdown. Render probes `/ready`, while the Docker health check uses `/health`. Pino logs carry request IDs, optional OpenTelemetry connects trace/span IDs, and existing metrics cover HTTP, database, payment, reconciliation, ledger, and outbox outcomes. Idempotent in-process loops recover expired reservations, captured payments, refund obligations, seller-balance drift, and unpublished outbox rows.

The controlled GitHub Actions catalog profile used one frozen production API image, API limits of 1 CPU/512 MiB, PostgreSQL limits of 1 CPU/1 GiB, a configured 150 RPS hold for 60 seconds, and three equivalent serial repetitions. Every repetition recorded zero HTTP failures and zero dropped iterations. The repeated 200 RPS set was unstable: latency thresholds failed and iterations dropped while API CPU approached its limit and PostgreSQL remained in the low teens. This identifies a controlled-CI API-CPU boundary; it is **not** a claim that production or Render supports 150 RPS.

**Evidence:** [capacity model](docs/architecture/capacity.md), [k6 report](docs/performance/load-test-report-2026-09-10-catalog.md), [SLOs](docs/operations/slos.md), [dashboards/instrument map](docs/operations/dashboards.md), and the [runbook](docs/operations/runbook.md).

Five-minute walkthrough: [`docs/portfolio/interview-narrative.md`](docs/portfolio/interview-narrative.md).

## Architecture

```text
React / Vite
     |
     | HTTP/JSON
     v
Express modular monolith
     |
     +-- auth
     +-- users
     +-- sellers
     +-- products / catalog
     +-- listings
     +-- orders
     +-- payments
     +-- commissions / ledger
     +-- reviews
     +-- favorites
     +-- admin
     |
     v
Prisma → PostgreSQL

External boundaries:
- PayPal
- Resend
- cs2.sh (optional catalog import)
```

Preferred backend dependency direction:

```text
Routes / Controllers → Services / Domain → Repositories → Prisma / PostgreSQL
```

The application remains a modular monolith. Redis, Kafka, SQS, microservices and similar infrastructure are not current components because measured evidence has not justified them.

Architecture and diagrams: [`current-state.md`](docs/architecture/current-state.md), [`c4.md`](docs/architecture/c4.md), and [`modular-monolith.md`](docs/architecture/modular-monolith.md).

## Tech stack

**Backend:** Node.js 20, TypeScript, Express, Prisma, PostgreSQL, Zod, Pino, Vitest.

**Frontend:** React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui.

**Infrastructure/tooling:** Docker, Docker Compose, GitHub Actions, Vercel, Render, k6.

**Integrations:** PayPal, Resend, optional cs2.sh catalog import.

## Deployment

Primary portfolio topology:

```text
Vercel frontend → Render API → Render PostgreSQL
```

- Vercel builds the React/Vite frontend from the repository root.
- Render runs `neon-arsenal-api` from `server/Dockerfile` and injects the managed PostgreSQL `DATABASE_URL`.
- `/health` is liveness and `/ready` is readiness.

Canonical deployment map: [`docs/operations/deployment.md`](docs/operations/deployment.md)

## Running locally

Requirements:

- Node.js 20
- npm
- Docker + Docker Compose

Install dependencies:

```bash
git clone https://github.com/Bruno2K/neon-arsenal-market.git
cd neon-arsenal-market
npm ci
npm ci --prefix server
```

Copy the example environment files and provide local values:

```text
.env.example
server/.env.example
```

Start API + PostgreSQL:

```bash
docker compose up --build
```

Start the containerized Vite dev frontend too:

```bash
docker compose --profile dev up --build
```

Or run frontend/backend development processes directly:

```bash
npm run dev:fullstack
```

Default local endpoints:

```text
Frontend: http://localhost:5173
API:      http://localhost:3001
Swagger:  http://localhost:3001/docs
Ready:    http://localhost:3001/ready
Health:   http://localhost:3001/health
```

## API contract

The current public API is `/api/v1`. Existing unversioned domain routes remain compatibility aliases of the same handlers.

Raw OpenAPI document:

```text
GET /docs/json
```

Versioning policy: [`docs/architecture/api-versioning.md`](docs/architecture/api-versioning.md)

## Verification

Canonical repository/agent-contract verification:

```bash
python scripts/verify.py
```

Frontend:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Backend:

```bash
npm run typecheck --prefix server
npm run test:unit --prefix server
npm run test:contract --prefix server
npm run test:integration --prefix server
npm run build --prefix server
```

Integration tests require PostgreSQL and apply real Prisma migrations. A local isolated test database is available with:

```bash
docker compose --profile test up db-test -d
```

Testing details: [`docs/testing.md`](docs/testing.md)

## Security posture

The HTTP edge treats the browser and provider callbacks as untrusted. Client identity does not trust caller-supplied forwarding headers; on Render, rate limiting and audit identity use the platform-overwritten client-IP header, otherwise the socket peer. Authentication, ownership, and role checks remain inside the API boundary. PayPal webhooks require cryptographic verification and bounded transmission time before event handling.

CI blocks runtime High/Critical npm findings, all Critical npm findings, and High/Critical Trivy findings in the deployable `server/` context. Secrets remain deployment variables and are excluded from Git. Development-only exceptions are explicit rather than silently ignored.

Evidence: [threat model](docs/architecture/threat-model.md), [API hardening checklist](docs/security/api-hardening-checklist.md), [dependency vulnerability policy](docs/security/dependency-vulnerability-policy.md), [`ADR 0023`](docs/adr/0023-rate-limit-client-identity.md), and [CI protection](docs/operations/ci-protection.md).

## Current limitations and conditional scaling path

Current limitations are deliberate and visible:

- one modular-monolith API service and one PostgreSQL primary;
- reconciliation, expiry, ledger, and outbox jobs run inside the API process;
- PostgreSQL connections bound horizontal replica count;
- rate-limit counters are in-process and do not coordinate across replicas;
- PayPal is the only payment provider;
- the public portfolio environment may seed demo data on boot;
- capacity evidence comes from controlled CI, not a production benchmark.

Scaling follows measured bottlenecks. If API CPU saturates while PostgreSQL retains headroom, test more API CPU or replicas. If connection, query, lock, or I/O pressure moves to PostgreSQL, profile queries, indexes, pagination, and pool budgets before scaling the database. If in-process jobs show sustained lag or coordination failure, evaluate an external worker/queue then. If multiple replicas require a shared rate-limit identity, introduce a shared store only for that demonstrated need.

See [`docs/architecture/scaling-path.md`](docs/architecture/scaling-path.md) and [`docs/architecture/capacity.md`](docs/architecture/capacity.md).

## Repository map

```text
.
├── src/                         # React frontend
├── public/                      # static frontend assets
├── server/
│   ├── src/                     # Express modular monolith
│   ├── prisma/                  # schema + forward migrations
│   └── Dockerfile               # production API image
├── docs/
│   ├── adr/                     # architecture decisions
│   ├── architecture/            # current system + invariants/trade-offs
│   ├── specs/                   # material behavior contracts
│   ├── plans/                   # implementation decomposition
│   ├── tasks/                   # bounded executable work
│   ├── operations/              # deployment/runbooks/SLOs
│   ├── performance/             # benchmark evidence
│   └── portfolio/               # concise interview narrative
├── load-tests/k6/               # controlled load-test harness
├── scripts/                     # deterministic repository verification
├── tests/tooling/               # verification-script regression tests
├── .github/workflows/           # CI + reproducible evidence workflows
├── .cursor/                     # thin environment/provider adapters
├── .husky/                      # local pre-commit checks
├── Dockerfile.frontend          # local/containerized frontend path
├── docker-compose.yml           # local/test topology
├── render.yaml                  # canonical Render API + PostgreSQL resources
└── vercel.json                  # primary public frontend deployment
```

## Engineering documentation

Useful entry points:

- [`AGENTS.md`](AGENTS.md) — global engineering/domain guardrails for coding agents.
- [`docs/agents/harness.md`](docs/agents/harness.md) — repository-native execution protocol.
- [`docs/architecture/current-state.md`](docs/architecture/current-state.md) — current architecture.
- [`docs/architecture/domain-invariants.md`](docs/architecture/domain-invariants.md) — critical domain invariants.
- [`docs/architecture/failure-modes.md`](docs/architecture/failure-modes.md) — failure reasoning.
- [`docs/architecture/capacity.md`](docs/architecture/capacity.md) — capacity evidence and scaling implications.
- [`docs/operations/runbook.md`](docs/operations/runbook.md) — operational recovery.
- [`docs/adr/README.md`](docs/adr/README.md) — architecture decision index.
- [`docs/portfolio/interview-narrative.md`](docs/portfolio/interview-narrative.md) — five-minute technical walkthrough.

The repository also uses a small, repository-native agent workflow for specification, planning, bounded execution, and verification. It supports the engineering process; it is not the product or the portfolio's central story.

## Project status

Active portfolio project focused on Senior Backend Engineering evidence. Current priorities favor correctness, security, reliability, operational clarity and measurable evidence over feature count or speculative distributed infrastructure.
