# Deployment topology

This document is the canonical public deployment map for Neon Arsenal Market.

## Primary portfolio topology

```text
Browser
  ↓
Vercel — React/Vite frontend
  ↓ HTTPS
Render — Express API (`neon-arsenal-api`)
  ↓
Render PostgreSQL (`neon-arsenal-db`)

External provider boundaries from the API:
- PayPal
- Resend
- cs2.sh (optional catalog import)
```

The repository intentionally uses a split frontend/backend deployment. Vercel is the primary frontend target because the repository already contains `vercel.json` and the live preview/deployment integration. Render is the canonical backend/database cloud target under ADR 0007.

The Render Blueprint also contains `neon-arsenal-web`, an optional static-site alternative for deploying the frontend on Render. It is not required for the primary Vercel + Render API topology and must not be interpreted as a second mandatory production frontend.

## Frontend — Vercel

Source: repository root.

Relevant files:

- `vercel.json` — Vite build and SPA rewrites.
- `vite.config.ts` — build-time API origin resolution and production localhost rejection.
- `.env.example` — documented public configuration surface.

Required public configuration:

```text
API_URL=https://<render-api-origin>
```

`API_URL` is public browser configuration, not a secret. The production Vite build rejects a localhost API origin.

React Router deep links are handled by the Vercel rewrite to `index.html`; the build also emits `dist/404.html` as a fallback artifact.

## Backend — Render

Source: `server/`.

Relevant files:

- `render.yaml` — Blueprint declaration.
- `server/Dockerfile` — production API image.
- `docs/operations/runbook.md` — operational procedures.
- `docs/operations/container-hardening.md` — container posture and limitations.

Canonical service identity:

```text
neon-arsenal-api
```

Render readiness probe:

```text
GET /ready
```

Liveness remains:

```text
GET /health
```

The API binds to `0.0.0.0:$PORT`, treats PostgreSQL as transactional source of truth, and performs graceful drain on SIGTERM/SIGINT.

## PostgreSQL — Render managed database

Canonical database identity in the Blueprint:

```text
neon-arsenal-db
```

`DATABASE_URL` is injected into the API from the Render database resource. Schema evolution is performed with forward Prisma migrations; applied migrations are not rewritten.

## Configuration ownership

Secrets belong in the deployment platform, never in Git:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `RESEND_API_KEY`
- `CS2SH_API_KEY` when used

Non-secret deployment configuration includes values such as `API_URL`, `FRONTEND_URL`, expiry durations, timeouts, and demo-seed flags. Inspect `.env.example`, `server/.env.example`, and the actual configuration modules before introducing a new environment variable.

## Demo data

`SEED_DEMO_DATA=true` is appropriate only for the public portfolio/demo environment. The seed is idempotent and should not be enabled for a real marketplace deployment.

## Local topology

`docker-compose.yml` is for local development/test infrastructure, not the production deployment definition.

- `docker compose up --build` — API + PostgreSQL.
- `docker compose --profile dev up --build` — API + PostgreSQL + Vite dev frontend.
- `docker compose --profile test up db-test -d` — isolated PostgreSQL integration-test database.

`Dockerfile.frontend` exists for local/containerized frontend workflows. The primary public frontend deployment is built directly by Vercel from the repository root.

## What is not deployed

The repository intentionally does not claim live Redis, Kafka, RabbitMQ, SQS, Terraform, ECS, Kubernetes, Prometheus, or Grafana infrastructure. ADRs document why several of those technologies were not adopted. Do not present architecture diagrams or future scaling options as deployed infrastructure.

## Change policy

A topology change is material architecture/operations work. Update the relevant ADR, this deployment map, README, Blueprint/configuration, runbook, and verification evidence together. Do not silently turn an optional deployment path into the canonical one.
