# Neon Arsenal Market

A full-stack CS2 skin marketplace built to explore backend architecture, authentication, payments, transactional workflows, and production-oriented engineering practices.

## Overview

Neon Arsenal Market simulates a marketplace where users can buy and sell Counter-Strike 2 skins.

The project focuses primarily on the backend and its business rules, including:

- Authentication and authorization
- Seller management and approval
- Unique physical listings
- Order lifecycle and inventory states
- PayPal payment integration
- Seller commissions and balances
- Input validation and rate limiting
- PostgreSQL persistence
- API documentation
- Dockerized local infrastructure
- Automated testing and CI
- Optional OpenTelemetry traces and metrics

## Architecture

The backend is organized by domain modules using a layered structure:

```text
server/src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── sellers/
│   ├── products/
│   ├── listings/
│   ├── orders/
│   ├── payments/
│   ├── commissions/
│   ├── reviews/
│   └── admin/
│
└── shared/
    ├── database/
    ├── errors/
    ├── middleware/
    ├── routes/
    └── utils/
```

The main backend flow follows:

```text
Controller → Service → Repository → PostgreSQL
```

with shared concerns such as authentication, validation, rate limiting, error handling, logging, and infrastructure isolated from business modules.

## Backend Highlights

### Authentication

- JWT access tokens
- Refresh token rotation
- Refresh token revocation
- Email verification flow
- Role-based authorization
- Password hashing with bcrypt

### Orders & Inventory

Listings represent unique items and move through explicit states:

```text
ACTIVE → RESERVED → SOLD
       ↘ CANCELED
```

Order creation creates the order and reserves its listings inside a database transaction.

### Payments

PayPal is integrated into the order flow through:

```text
Order
  ↓
Payment creation
  ↓
PayPal
  ↓
Webhook
  ↓
Payment confirmation
  ↓
Order confirmation + listings marked SOLD
  ↓
Seller transaction + balance update
```

### Seller Commissions

When a payment is confirmed, seller transactions are generated from the order items and commissions are calculated from the seller's commission rate.

### Validation & Security

- Zod request validation
- Configurable IP-based rate limiting
- Restricted CORS
- JWT authentication
- bcrypt password hashing
- Centralized application errors
- Request IDs
- Structured logging with Pino

## Tech Stack

### Backend

- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- shadcn/ui

### Infrastructure

- Docker
- Docker Compose
- GitHub Actions
- Vercel
- Render

### Integrations

- PayPal
- Resend

## Deployment

For the common split deployment, use Vercel for the Vite frontend and Render for the Express API:

- In Vercel, add `API_URL` as **Config** (not Sensitive) with the public Render API origin, for example `https://neon-arsenal-market-api.onrender.com`. Do not use the `VITE_` prefix. A production frontend build fails if this still points at localhost.
- In Render, set `FRONTEND_URL` to the public frontend origin. Use a comma-separated list when allowing both production and preview origins.
- In Render, set `RESEND_API_KEY` and `EMAIL_FROM` so production registration can send verification codes.
- Keep `SEED_DEMO_DATA=true` only for demo/test deployments that should expose the seeded accounts shown on the login page.
- `vercel.json` rewrites React Router paths to `index.html` so direct page refreshes do not return 404.

The Render Blueprint also defines an optional `neon-arsenal-web` static site. If you deploy the frontend on Render instead of Vercel, set its `API_URL`; the Blueprint includes the same SPA rewrite to `index.html`.

### Testing & Documentation

- Vitest
- OpenAPI / Swagger UI

## Project Structure

```text
.
├── src/                  # React application
├── server/
│   ├── src/
│   │   ├── modules/      # Domain modules
│   │   └── shared/       # Shared infrastructure
│   └── prisma/           # Database schema and migrations
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Running Locally

### Requirements

- Node.js 18+
- Docker
- Docker Compose

### Install

```bash
git clone https://github.com/Bruno2K/neon-arsenal-market.git
cd neon-arsenal-market

npm install
cd server
npm install
cd ..
```

### Environment

Create the required environment files using the provided examples:

```text
.env.example
server/.env.example
```

The application uses PostgreSQL for the main database and Docker Compose can provision the local database.

### Start the infrastructure

```bash
docker compose up --build
```

For frontend development with hot reload:

```bash
docker compose --profile dev up --build
```

### Start the application

```bash
npm run dev:fullstack
```

The frontend runs on:

```text
http://localhost:5173
```

The API runs on:

```text
http://localhost:3001
```

## API Documentation

Swagger UI is available at:

```text
http://localhost:3001/docs
```

The raw OpenAPI document is available at:

```text
http://localhost:3001/docs/json
```

## Testing

Frontend:

```bash
npm test
```

Backend (from `server/`):

```bash
npm run test:unit            # no PostgreSQL
npm run test:integration     # real PostgreSQL; fails if the database is down
npm run test:all             # unit then integration
```

Integration tests apply Prisma migrations (`prisma migrate deploy`) and run against PostgreSQL. They are not skipped when `DATABASE_URL` is missing.

Local isolated database:

```bash
docker compose --profile test up db-test -d
```

Then set `TEST_DATABASE_URL=postgresql://neon:test@localhost:5433/neon_arsenal_test` and run `npm run test:db:prepare` followed by `npm run test:integration` in `server/`.

See `docs/testing.md` for isolation, concurrency and CI details.

## Health & Readiness

The API exposes separate liveness and readiness endpoints:

```text
GET /health
GET /ready
```

`/health` checks process liveness, while `/ready` verifies database connectivity.

## Observability

The API keeps Pino and `X-Request-Id`. OpenTelemetry is **disabled by default**.

```bash
OTEL_ENABLED=true npm run dev --prefix server
```

Exporters: `none` (default), `console`, or `otlp`. A missing collector does not prevent the process from starting. See `docs/observability.md`.

## Engineering Notes

This project is intentionally more than a CRUD application.

The main areas explored are:

- Domain-oriented backend modules
- Transactional workflows
- Authentication and token lifecycle
- Inventory state management
- Payment integration
- External webhook processing
- Seller financial flows
- API validation and security
- Containerized development
- Production-oriented health checks
- Automated testing and API documentation

## Future Improvements

Potential next iterations include:

- Stronger concurrency control around listing reservation
- Idempotency for remaining payment initiation flows
- Improved monetary precision using database-native decimal operations
- Asynchronous processing for non-critical workflows
- Distributed rate limiting
- Stronger production export of traces/metrics (collector, dashboards)
- Benchmarks and query plans for the hottest checkout paths

## Project Status

Portfolio project focused on backend engineering, system design, and production-oriented development with TypeScript.
