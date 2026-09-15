# Neon Arsenal Market

Neon Arsenal Market is a marketplace for individually owned Counter-Strike 2 skin listings. Its engineering core is a Node/Express modular monolith backed by PostgreSQL, designed around concurrency-sensitive unique inventory, trustworthy payment and refund state, partial failure at the PayPal boundary, and operational recovery. The React/Vite client is the product surface; the repository's strongest evidence is in the backend invariants, transactions, failure handling, tests, and operations.

**Portfolio status:** release candidate for **PORTFOLIO COMPLETE / MAINTENANCE** after PR13 receives human review and is merged. Start with the [10–15 minute reviewer guide](docs/portfolio/reviewer-guide.md) or the [backend engineering case study](docs/portfolio/case-study.md).

## Why this project exists

This repository demonstrates backend engineering through inspectable proof rather than technology count. It covers transactional consistency, idempotency, concurrency control, payment-provider partial failure, refund reconciliation, an append-only seller ledger, transactional outbox recovery, observability, controlled performance measurement, security boundaries, and operational readiness.

Work is AI-assisted under a repository-owned authority chain: specifications define material behavior, ADRs record decisions, invariants state correctness properties, Tasks bound implementation, and tests/CI/evidence validate the result. Agents implement within those controls; humans decide material ambiguity and retain the merge gate. See the [engineering authority](docs/architecture/ai-engineering-authority.md), [direct agent harness](docs/agents/harness.md), and [workflow evidence](docs/verification/interview-focused-ai-workflow.md).

## Architecture

```text
React / Vite on Vercel
          |
          | HTTPS / JSON
          v
Node / Express modular monolith on Render
          |
          +---- PayPal (payment trust boundary)
          +---- Resend
          +---- cs2.sh (optional catalog import)
          |
          v
Prisma -> PostgreSQL on Render (transactional source of truth)
```

The API owns the auth, users, sellers, Catalog, listings, orders, payments, Ledger, reviews, favorites, admin, and audit modules. Reservation expiry, PayPal/refund reconciliation, seller-ledger reconciliation, and outbox dispatch are idempotent jobs inside the API process; they are not separate services. Provider I/O stays outside critical database transactions, while local state transitions use conditional writes, constraints, and explicit transaction boundaries.

Current system map: [architecture overview](docs/architecture/current-state.md), [C4 diagrams](docs/architecture/c4.md), [module boundaries](docs/architecture/modular-monolith.md), and [ADR index](docs/adr/README.md).

## Engineering highlights

- **Exclusive reservation under concurrency:** two buyers cannot both acquire one unique listing; payment must still own a live hold. [Invariant and proof](docs/domain/invariants.md#inv-listing-exclusive-reserve)
- **SOLD irreversibility:** cancellation and payment races use mutually guarded state transitions. [Invariant and PR11 regression evidence](docs/domain/invariants.md#inv-listing-sold-irreversible)
- **Retry-safe order and payment workflows:** durable customer idempotency, payment-link identity, and provider-event identity converge duplicate calls. [ADR 0003](docs/adr/0003-order-creation-idempotency.md) · [webhook tests](server/src/__tests__/paypal.webhook.integration.test.ts)
- **Trusted PayPal confirmation:** the browser cannot declare payment success; authenticated provider `COMPLETED` state gates the local transaction. [Invariant](docs/domain/invariants.md#inv-payment-trusted-confirm) · [ADR 0002](docs/adr/0002-paypal-webhook-reliability.md)
- **Refund recovery after partial failure:** captured-but-unfulfillable payments create one durable obligation, reuse a stable provider request identity, and reconcile remote success before local completion. [SPEC-0013](docs/specs/SPEC-0013-refund-financial-compensation.md) · [reconciliation tests](server/src/__tests__/refund.reconciliation.integration.test.ts)
- **Append-only seller finances:** exact Decimal arithmetic, immutable credit/compensation movements, database constraints, and a reconcilable balance projection preserve economic history. [Ledger invariant](docs/domain/invariants.md#inv-seller-ledger-source) · [ADR 0011](docs/adr/0011-seller-ledger.md)
- **Transactional outbox:** payment state and outbox rows commit together; PostgreSQL claims and stale-work recovery provide bounded at-least-once delivery without pretending to be Kafka. [ADR 0012](docs/adr/0012-transactional-outbox.md) · [outbox tests](server/src/__tests__/outbox.integration.test.ts)
- **Exact API inventory:** contract tests compare OpenAPI operations with the live Express route graph, including nested routers. [Contract test](server/src/__tests__/openapi.http.contract.test.ts) · [inventory implementation](server/src/shared/docs/routeInventory.ts)
- **Evidence-bounded performance:** three controlled 150 RPS catalog repetitions passed; repeated 200 RPS runs exposed an API-CPU boundary. This is not a production-capacity claim. [Load-test report](docs/performance/load-test-report-2026-09-10-catalog.md)
- **Operational recovery:** health/readiness, signals, SLO targets, failure modes, runbooks, game days, and provider-level unknowns are explicit. [PR12 proof](docs/verification/production-operational-proof-2026-09-15.md)

## Evidence

The [portfolio evidence index](docs/portfolio/evidence-index.md) maps each important claim to implementation and proof. High-signal entry points:

- [Final Senior Backend Audit — PR11](docs/verification/final-senior-backend-audit-2026-09-14.md) ([merged PR #260](https://github.com/Bruno2K/neon-arsenal-market/pull/260))
- [Production & Operational Proof — PR12](docs/verification/production-operational-proof-2026-09-15.md) ([merged PR #261](https://github.com/Bruno2K/neon-arsenal-market/pull/261))
- [Domain invariant catalog](docs/domain/invariants.md)
- [Architecture decision index](docs/adr/README.md)
- [Threat model](docs/architecture/threat-model.md)
- [Performance report](docs/performance/load-test-report-2026-09-10-catalog.md)
- [OpenAPI route-inventory contract](server/src/__tests__/openapi.http.contract.test.ts)
- [CI workflow](.github/workflows/ci.yml) and [repository verification workflow](.github/workflows/repository-verification.yml)

## Live demo

- [Frontend — Vercel](https://neon-arsenal-market.vercel.app/)
- [API health — Render](https://neon-arsenal-market-api.onrender.com/health)
- [API readiness — Render](https://neon-arsenal-market-api.onrender.com/ready)
- [OpenAPI UI — Render](https://neon-arsenal-market-api.onrender.com/docs)

These are portfolio/demo endpoints, not an uptime, capacity, backup, or production-SLO claim. The exact deployed API SHA is not exposed by the public probes.

## Known limits

- Six valid PR11 P1 items are frozen: confirmed-order cancellation/refund policy, stuck payment-link claim recovery, deeper capture reconciliation after expiry cancellation, historical agent-document residue, standalone-reservation griefing, and transactional onboarding composition. [Details](docs/portfolio/project-status.md#frozen-backlog)
- Production OTLP reception, retention, dashboards, and alert routing are **NOT PROVEN**; there is no pager.
- `render.yaml` declares Free PostgreSQL. The actual live plan and backup posture are **NOT PROVEN**, and no external backup/restore automation is claimed.
- Production capacity, multi-region operation, HA/failover, and sustained production SLO attainment are not claimed. The 150 RPS result is controlled CI evidence only.
- Background jobs and rate-limit counters remain in-process. Multi-instance coordination limits are documented.
- Kafka, Kubernetes, microservices, CQRS, event sourcing, Redis, service mesh, and an AWS rewrite were deliberately rejected because no measured need justifies them.

The complete boundary and freeze policy is in [project status](docs/portfolio/project-status.md).

## Run locally

Prerequisites: Node.js 20, npm, Docker, and Docker Compose.

```bash
git clone https://github.com/Bruno2K/neon-arsenal-market.git
cd neon-arsenal-market
npm ci
npm ci --prefix server
```

Copy `.env.example` and `server/.env.example`, then provide local values. Start the API and PostgreSQL:

```bash
docker compose up --build
```

Start the containerized Vite client too:

```bash
docker compose --profile dev up --build
```

Or run both development processes directly:

```bash
npm run dev:fullstack
```

Local endpoints: frontend `http://localhost:5173`, API `http://localhost:3001`, OpenAPI UI `http://localhost:3001/docs`, readiness `http://localhost:3001/ready`, health `http://localhost:3001/health`.

Run the canonical repository checks with:

```bash
python scripts/verify.py
```

Frontend and backend commands are documented in [testing](docs/testing.md); deployment and recovery procedures are in the [operator runbook](docs/operations/runbook.md).

## API contract

The public API is mounted under `/api/v1`; unversioned domain paths remain compatibility aliases of the same routers. The OpenAPI UI is `/docs` and the raw document is `GET /docs/json`. See the [versioning policy](docs/architecture/api-versioning.md).

## Repository map

```text
src/                         React/Vite frontend
server/src/modules/          backend business modules
server/src/shared/           shared infrastructure and cross-cutting controls
server/prisma/               PostgreSQL schema and forward migrations
docs/adr/                    architecture decisions
docs/architecture/           current system, invariants, risks, capacity
docs/operations/             deployment, signals, SLOs, runbooks
docs/performance/            controlled measurement evidence
docs/portfolio/              reviewer path, case study, evidence, status
docs/specs/                  material behavior contracts
docs/plans/ and docs/tasks/  bounded implementation history and state
.github/workflows/           CI, security, contracts, builds, load evidence
```

## Project status

PR10 closed the convergence phase, PR11 merged the final adversarial audit and seven P0 corrections, PR12 merged bounded production/operational proof, and PR13 is the final portfolio release. No PR14 is planned. After human merge of PR13, the project enters maintenance/freeze mode under the [project status policy](docs/portfolio/project-status.md).
