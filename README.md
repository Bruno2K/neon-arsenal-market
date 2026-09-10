# Neon Arsenal Market

Backend-first marketplace portfolio project for Counter-Strike 2 skins, built to demonstrate Senior Backend Engineering through correctness, financial consistency, failure recovery, operational evidence, and explicit trade-offs.

The product surface is a React/Vite marketplace. The engineering focus is the TypeScript/Express/PostgreSQL backend: unique-item reservation, idempotent order creation, PayPal capture/webhook reconciliation, refund compensation, append-only seller ledger behavior, security hardening, observability, and reproducible load-test evidence.

## Engineering focus

The repository is intentionally more than a CRUD demo. The strongest backend stories are:

- atomic reservation of unique listings under concurrent buyers;
- customer-scoped order idempotency persisted in PostgreSQL;
- explicit order/listing/payment state transitions;
- authenticated PayPal webhook processing and reconciliation;
- automatic full compensation when a capture cannot be fulfilled locally;
- append-only seller financial history with balance projection;
- transactional outbox and in-process recovery loops;
- PostgreSQL integration/concurrency tests;
- API versioning and OpenAPI contract checks;
- request IDs, structured logs and optional OpenTelemetry;
- controlled k6 evidence with a reproducible catalog workload;
- repository-native AI-assisted engineering contracts and deterministic verification.

AI coding agents are implementation/review tools. Requirements, architecture, trade-offs, human approval, and final acceptance remain human-owned.

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

The application remains a modular monolith. Redis, Kafka, SQS, microservices and similar infrastructure are not added merely to make the project appear more complex.

Architecture map: [`docs/architecture/current-state.md`](docs/architecture/current-state.md)

## Critical workflows

### Unique-item checkout

Listings represent unique inventory. Order creation reserves listings with a PostgreSQL transaction and conditional state change so two concurrent buyers cannot both acquire the same item.

```text
ACTIVE → RESERVED → SOLD
       ↘ CANCELED
```

`POST /orders` requires an `Idempotency-Key`; the key, canonical request hash, order and reservation effects converge inside PostgreSQL.

### Payments and reconciliation

PayPal is treated as an unreliable external system. Provider calls are kept outside critical PostgreSQL transactions, while local state transitions remain transactional and idempotent.

```text
Local order
   ↓
PayPal order / capture
   ↓
Webhook or reconciliation
   ↓
Trusted COMPLETED state
   ↓
Order + listing + ledger + balance + outbox transaction
```

Duplicate/out-of-order delivery, retries, process crashes and remote-success/local-failure states are explicit failure modes.

### Refund compensation

If PayPal has already captured funds but the marketplace can no longer fulfill the order because the valid reservation was lost or expired, the system creates a durable compensation obligation and converges through an idempotent full refund.

Seller financial history is append-only: an applied credit is compensated by a separate reversal rather than destructive mutation.

See [`SPEC-0013`](docs/specs/SPEC-0013-refund-financial-compensation.md) and [`ADR 0024`](docs/adr/0024-refund-compensation.md).

## Performance evidence

The repository contains a controlled GitHub Actions k6 harness and a reproducible catalog capacity result.

In the documented CI topology — API limited to 1 CPU / 512 MiB and PostgreSQL to 1 CPU / 1 GiB — the catalog profile reproduced a **150 RPS hold for 60 seconds across three equivalent repetitions**, with zero HTTP failures and zero dropped iterations. This is controlled-CI evidence, not a claim about Render production capacity.

Report: [`docs/performance/load-test-report-2026-09-10-catalog.md`](docs/performance/load-test-report-2026-09-10-catalog.md)

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
- `render.yaml` also contains an optional Render static frontend alternative; it is not required for the primary Vercel topology.
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

## Repository map

```text
.
├── src/                         # React frontend
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
│   └── performance/             # benchmark evidence
├── load-tests/k6/               # controlled load-test harness
├── .github/workflows/           # CI + reproducible evidence workflows
├── Dockerfile.frontend          # local/containerized frontend path
├── docker-compose.yml           # local/test topology
├── render.yaml                  # Render API/DB + optional static frontend
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

## Project status

Active portfolio project focused on Senior Backend Engineering evidence. Current priorities favor correctness, security, reliability, operational clarity and measurable evidence over feature count or speculative distributed infrastructure.
