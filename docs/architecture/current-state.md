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

The backend entrypoint is `server/src/app.ts`. It applies request IDs, CORS, JSON parsing, rate limiting, health/docs routes, domain routes, 404 handling and centralized error handling.

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

The repository already has repository abstractions, but some services access Prisma directly. For example, `orders.service.ts` imports both `prisma` and `ordersRepository`, and performs transaction work directly through Prisma while using the repository for some reads.

This is not an emergency rewrite target. Agents should avoid broad refactors. When touching a module, improve the boundary only when the change is directly related to the task and can be kept small and well tested.

## Database

PostgreSQL is the source of truth for business state. Prisma is the data-access layer.

The schema contains the main marketplace entities: users, pending registrations, sellers, products, listings, orders, order items, seller transactions, payment webhook events, reviews and revoked tokens. Listings contain reservation fields `reservedAt`, `reservationExpiresAt` and `reservedByOrderId`. `PaymentWebhookEvent` stores PayPal event identity with a unique `(provider, externalEventId)` constraint.

## Critical workflows

### Order creation

Order creation currently uses a PostgreSQL transaction and an atomic conditional listing update. The transition to `RESERVED` is guarded by `status = ACTIVE` and trade-lock conditions, preventing two concurrent requests from both reserving the same listing. The same update persists `reservedAt`, `reservationExpiresAt` and `reservedByOrderId`. The order and order items are then created inside the same transaction.

Expired reservations are released by an in-process sweep that calls `listingsService.expireReservations()`. The listing UPDATE is conditional on `status = RESERVED` and `reservationExpiresAt <= now`, so it cannot overwrite `SOLD`. Payment confirmation requires `status = RESERVED`, `reservedByOrderId = orderId` and `reservationExpiresAt > now`; if that UPDATE does not cover every order item, the payment transaction rolls back. Unpaid orders are cancelled when they no longer hold their listings, including the case where the listing was reserved by a later order.

### Payment confirmation

Payment creation calls PayPal outside the database transaction, with an explicit timeout (`PAYPAL_API_TIMEOUT_MS`, default 10s). `OrdersCreate` is not retried. The PayPal order ID is stored on the local order.

Webhook handling:

1. Capture the raw body and verify RSA-SHA256 using `PAYPAL_WEBHOOK_ID` and the certificate at `paypal-cert-url`.
2. Claim `PaymentWebhookEvent` by PayPal event id (`id`, e.g. `WH-...`).
3. Confirm locally only on `PAYMENT.CAPTURE.COMPLETED`. `CHECKOUT.ORDER.APPROVED` is persisted as ignored.
4. `confirmPayment` claims the pending order, sells held listings, and writes seller transactions in one PostgreSQL transaction.

A process crash after PayPal capture is recovered by webhook retry (unique event id) or the in-process reconciliation job, which GETs PayPal order status for stale `PENDING` orders (every 60s, minimum age 2 minutes, batch 20) and reuses `confirmPayment`.

## Runtime configuration

The backend package provides scripts for development, build, type checking, tests and Prisma migrations.

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
