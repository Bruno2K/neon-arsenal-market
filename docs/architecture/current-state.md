# Current Architecture

> This document describes the intended current architecture. It is a working map for AI agents and must be updated when structural decisions change.

## System shape

Neon Arsenal Market is a full-stack application with a **modular-monolith backend**.

```text
React/Vite client
       |
       | HTTP/JSON
       v
Express API
       |
       +--> auth
       +--> users
       +--> sellers
       +--> products
       +--> listings
       +--> orders
       +--> payments
       +--> commissions
       +--> reviews
       +--> admin
       |
       v
PostgreSQL via Prisma

External boundary:
Express API --> PayPal
Express API --> Resend
```

The backend entrypoint is `server/src/app.ts`. It applies request IDs, CORS, JSON parsing, rate limiting, health/docs routes, domain routes, 404 handling and centralized error handling. fileciteturn8file0L2-L2

## Backend layering

The preferred dependency direction is:

```text
Routes/Controllers
      ↓
Application / Domain Services
      ↓
Repositories
      ↓
Prisma / PostgreSQL
```

Shared infrastructure belongs in `server/src/shared/`. Business behavior belongs in `server/src/modules/<domain>/`.

### Important current inconsistency

The repository already has repository abstractions, but some services access Prisma directly. For example, `orders.service.ts` imports both `prisma` and `ordersRepository`, and performs transaction work directly through Prisma while using the repository for some reads. fileciteturn12file0L2-L2

This is not an emergency rewrite target. Agents should avoid broad refactors. When touching a module, improve the boundary only when the change is directly related to the task and can be kept small and well tested.

## Database

PostgreSQL is the source of truth for business state. Prisma is the data-access layer.

The schema contains the main marketplace entities: users, pending registrations, sellers, products, listings, orders, order items, seller transactions, reviews and revoked tokens. Listings already contain reservation-related timestamps and status fields, including `reservedAt` and `reservationExpiresAt`. fileciteturn7file0L2-L2

## Critical workflows

### Order creation

Order creation currently uses a PostgreSQL transaction and an atomic conditional listing update. The transition to `RESERVED` is guarded by `status = ACTIVE` and trade-lock conditions, preventing two concurrent requests from both reserving the same listing. The order and order items are then created inside the same transaction. fileciteturn12file0L2-L2

Known next step: complete the reservation lifecycle by recording expiry, safely expiring reservations, and proving expiration/payment races with integration tests.

### Payment confirmation

Payment creation calls PayPal outside the database transaction, then stores the PayPal order ID. Webhook handling maps the event to an internal order and calls payment confirmation. Payment confirmation atomically claims a pending order before marking listings sold and creating seller transactions/balance updates. fileciteturn13file0L2-L2

Known reliability gaps to address before calling this production-grade:

- webhook authenticity/signature validation;
- durable event identity/idempotency semantics;
- duplicate and out-of-order event handling;
- reconciliation;
- explicit external-call timeout/retry policy;
- crash recovery between external payment state and local state;
- integration tests for payment/reservation races.

## Runtime configuration

The backend package provides scripts for development, build, type checking, tests and Prisma migrations. fileciteturn6file0L2-L2

Agents must inspect the actual `.env.example` and configuration modules before introducing configuration. Never invent environment variables.

## Architectural rules

- Keep the backend modular-monolith unless a concrete scaling or isolation requirement proves otherwise.
- Keep PostgreSQL authoritative for transactional state.
- Keep transaction boundaries explicit.
- Prefer atomic database operations for invariants.
- Do not perform slow external calls inside critical database transactions.
- Do not introduce Kafka/Redis/RabbitMQ/SQS merely to demonstrate technology.
- Introduce infrastructure only when a measured or documented problem justifies it.
- Preserve security controls.
- Update architecture docs when a meaningful boundary changes.
