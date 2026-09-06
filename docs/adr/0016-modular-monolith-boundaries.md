# ADR 0016 — Explicit modular monolith boundaries

## Status

Accepted

## Context

Issue #59 / `SPEC-0006` asks for explicit boundaries for Auth, Users, Sellers, Catalog, Listings, Orders, Payments, Ledger, Reviews, and Admin, plus dependency rules that stop unconstrained cross-module access. It also asks to split large services — especially Payments — into application/domain/infrastructure *when complexity justifies it*.

The backend is already a single Express deployable with domain folders under `server/src/modules/`. PostgreSQL is the source of truth (ADR 0007 keeps Render). Folder names do not match the issue vocabulary: Catalog is `products`, Ledger is `commissions`. Production cross-module imports today are Admin composing existing ADMIN use cases, and mutating modules writing Audit.

`payments.service.ts` is large because it owns PaymentLink claims, webhook event identity, capture, reconciliation, and `confirmPayment`. PayPal HTTP already lives in `shared/utils`. `confirmPayment` sells listings, writes `SellerTransaction`, updates `Seller.balance`, and inserts outbox rows in one local transaction. Extracting collaborators into other modules or an extra layer would risk moving part of that write outside the transaction or creating a Payments → Orders/Listings/Ledger service cycle.

## Decision

1. **Stay a modular monolith.** One API process. No Redis, Kafka, RabbitMQ, SQS, or microservices.
2. **Map logical names to existing folders.** Do not rename `products` or `commissions`. Catalog = `modules/products`. Ledger = `modules/commissions`. Audit is a supporting module.
3. **Allowed production imports** are encoded in `server/src/shared/architecture/moduleBoundaries.ts` and described in `docs/architecture/modular-monolith.md`:
   - every module → `shared/`
   - Admin → Sellers, Orders, Catalog (`products`), Audit
   - Payments, Orders, Listings, Sellers, Ledger (`commissions`) → Audit
   - composition roots (`app.ts`, reservation expiry, PayPal reconcile, seller-ledger reconcile) → the services they already call
4. **Forbidden:** a domain module importing another domain module's service, repository, DTO, or routes unless the edge is listed. `shared/` outside jobs must not import `modules/`.
5. **Cross-table Prisma writes are not import violations** when they are a named workflow (order create + reserve; payment confirm + sell + ledger + outbox; payment-link claim). The owning service keeps the transaction.
6. **Do not split Payments in this change.** Complexity is transactional coupling, not missing folders. An application/domain/infrastructure split is deferred until a later Specification shows it can preserve `confirmPayment` atomicity, webhook idempotency, and no-retry `OrdersCreate` / `OrdersCapture`.
7. **Enforce with a unit test**, not a new linter dependency.

## Rollback

Delete the architecture contract, ADR, map doc, and unit test. Runtime behavior does not depend on them.

## Consequences

- A new cross-module production import fails CI unit tests unless the graph is updated in the same change.
- Agents must not "fix" boundary violations by calling another module's service from inside a payment or reservation transaction.
- Interviewers can point at a single map: logical name, folder, owner, allowed edges.
- Payments remains one application service with the PayPal adapter already isolated in `shared/utils`.
