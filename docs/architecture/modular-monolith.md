# Modular monolith — module boundaries

Authoritative import graph: `server/src/shared/architecture/moduleBoundaries.ts`.
Decision: `docs/adr/0016-modular-monolith-boundaries.md`.
Contract: `SPEC-0006`.

This is one Express API process and one PostgreSQL database. Modules are folders, not services.

## Logical modules

| Logical name | Folder | Owns |
|---|---|---|
| Auth | `modules/auth` | Register, email verify, login, refresh families, logout, login throttle |
| Users | `modules/users` | Authenticated profile (`/users/me`) |
| Sellers | `modules/sellers` | Seller records and approval writes |
| Catalog | `modules/products` | Product catalog and cs2.sh import |
| Listings | `modules/listings` | Unique items, reservation/expiry, price history |
| Orders | `modules/orders` | Checkout, idempotency key, fulfillment status |
| Payments | `modules/payments` | PaymentLink, webhook claim, capture, `confirmPayment`, PayPal GET reconcile |
| Ledger | `modules/commissions` | `Seller.balance` projection reads and projection-only reconcile |
| Reviews | `modules/reviews` | Product reviews |
| Favorites | `modules/favorites` | Account-owned saved listings (`GET/POST /favorites`, `DELETE /favorites/:listingId`) |
| Admin | `modules/admin` | ADMIN composition: users, orders, seller approval, audit read, catalog import |
| Audit | `modules/audit` | Append-only `AuditLog` (supporting; not a marketplace domain) |

HTTP mounts stay `/products` and `/commissions`. Do not rename folders to match logical names.

## Layering inside a module

```text
Routes / Controllers
      ↓
Application / Domain services
      ↓
Repositories (when present)
      ↓
Prisma / PostgreSQL
```

Some services still call Prisma directly. That is a known inconsistency (`docs/architecture/current-state.md`). Do not start a repository rewrite from this document.

Shared infrastructure (`jwt`, PayPal client, money helpers, outbox, observability, middleware) lives in `server/src/shared/`. Business rules live in the owning module.

## Allowed production imports

```text
*            → shared/
admin        → sellers, orders, products (Catalog), audit
payments     → audit
orders       → audit
listings     → audit
sellers      → audit
commissions  → audit   (Ledger)
```

All other module → module production imports are forbidden.

### Composition roots (not modules)

| Root | May import |
|---|---|
| `server/src/app.ts` | Any module route barrel already mounted |
| `shared/jobs/reservationExpiryJob.ts` | `listings` |
| `shared/jobs/paypalReconciliationJob.ts` | `payments` |
| `shared/jobs/sellerLedgerReconciliationJob.ts` | `commissions` (Ledger) |
| `shared/jobs/outboxDispatcherJob.ts` | `shared/outbox` only |

Other production files under `shared/` must not import `modules/`. Tests and scripts may import any module.

## Cross-table writes (allowed without importing the other service)

PostgreSQL transactions may touch tables owned by more than one module for these workflows only:

1. **Order create** — `Order`, `OrderItem`, `OrderIdempotencyKey`, listing `ACTIVE → RESERVED` in one transaction (`INV-ORDER-ATOMIC-CREATE`).
2. **Payment confirm** — claim order, listing `RESERVED → SOLD`, `SellerTransaction`, `Seller.balance` increment, outbox insert (`INV-PAYMENT-TRUSTED-CONFIRM`, `INV-SELLER-LEDGER-SOURCE`).
3. **Payment link claim** — `PaymentLink` plus `Order.paypalOrderId` after `OrdersCreate` (`INV-PAYMENT-LINK-IDEMPOTENT`).

Ledger *writes* on confirm belong to Payments. Ledger *projection reconcile* belongs to `commissions`. Do not invert that by having Payments import `commissionsService` or Listings import `ordersService`.

## Payments layering

Payments is **not** split into application/domain/infrastructure here.

- PayPal HTTP and webhook crypto already sit in `shared/utils`.
- `confirmPayment` must remain one local transaction.
- `OrdersCreate` and `OrdersCapture` are not retried.

A later change may split the file only with a Specification that preserves those rules.

## How to add a dependency

1. Justify the edge in the same PR (composition vs a new domain leak).
2. Update `moduleBoundaries.ts` and this document together.
3. Keep transactional writes in the owning service.

Do not add a module import to "look layered" when a Prisma write inside the existing transaction is the correct modular-monolith move.
