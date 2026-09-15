# Final Senior Backend Audit (PR11)

## Authorization and scope

User request on 2026-09-14: perform a complete adversarial Senior Backend audit of the
entire repository — asking specifically what arguments a Staff/Principal Engineer could
make for rejecting this project as evidence of Senior Backend Engineering — and correct
only confirmed credibility-critical (P0) gaps. PR12 (production/operational proof) and
PR13 (portfolio release) scope is explicitly out of bounds for PR11.

Baseline: `c55c7ba0cb26c498582855bc67d07b45545f92ee` (`main`, PR #247 merged).
Branch: `audit/pr11-final-senior-backend`.
Baseline CI: [CI run](https://github.com/Bruno2K/neon-arsenal-market/actions/runs/34891826877) PASS;
[repository verification run](https://github.com/Bruno2K/neon-arsenal-market/actions/runs/34891826904) PASS.

The audit was read-only against the baseline: no implementation file was edited until the
full findings matrix below was produced and every P0 was independently re-verified against
the actual current code, not against the described symptom alone.

## Findings matrix

28 dimensions, 34 findings. **PASS 18 · P0 7 · P1 8 · P2 1**.

| ID | Dimension | Finding and evidence | Severity | Why / action |
|---|---|---|---|---|
| AUD-001 | Correctness / concurrency | `listingsService.cancel` read status, then performed an unconditional `tx.listing.update` (`listings.service.ts:340-359` at baseline). A concurrent payment could commit `SOLD` in between, after which cancel overwrote it with `CANCELED`. Existing tests were sequential only. | P0 | Could commit a paid/credited order with a canceled listing, violating `INV-LISTING-SOLD-IRREVERSIBLE`. **Fixed** — see below. |
| AUD-002 | Order lifecycle | CUSTOMER may explicitly cancel `CONFIRMED`; docs state this does not create a refund (`order-status.ts:20-47`, `docs/domain/invariants.md:205`). | P1 | Explicit but incomplete product semantics, not a hidden inconsistency. Frozen backlog; requires a later cancellation/refund policy decision. |
| AUD-003 | Unique-item concurrency | Order reserve uses conditional `ACTIVE → RESERVED`, explicit `reservedByOrderId`, TTL, and one transaction; 8-way PostgreSQL tests prove exactly one winner (`orders.service.ts:37-150`, `checkout.concurrency.integration.test.ts`). | PASS | Flagship exclusivity claim is credible, subject to AUD-001's alternate cancel path (now closed). |
| AUD-004 | Transactions | Order creation, payment confirmation, refund completion/compensation, ledger projection, and outbox writes have coherent local transactions; PayPal I/O stays outside them. | PASS | Matches ADRs 0002/0012/0024/0025. |
| AUD-005 | Financial consistency / authorization | Caller-controlled `commissionRate` was accepted on seller application and on the seller-owned update (`sellers.dto.ts:4-12`, `sellers.service.ts:25-54` at baseline). A seller could select or later set `0`, and payment confirmation used whatever rate was currently stored (`payments.service.ts:346-356`). | P0 | Permitted unauthorized avoidance of marketplace commission. **Fixed** — see below. |
| AUD-006 | PayPal / refunds | Trusted `COMPLETED` only; `APPROVED` is intermediate; duplicate capture, remote-success/local-failure, stable refund identity, and append-only compensation are implemented and PostgreSQL-tested. | PASS | Central payment/refund mechanics are sound. |
| AUD-007 | Authentication | bcrypt policy, access/refresh token separation, durable refresh families, reuse revocation, expiry, login throttle, and production secret assertions align with tests. | PASS | No concrete authentication bypass found. |
| AUD-008 | Authorization / data exposure | Public `GET /sellers` and `GET /sellers/:id` returned full `Seller` rows including `user.email`, `balance`, and `commissionRate` (`sellers.routes.ts:9-12`, `sellers.repository.ts:4-22` at baseline), and an `?approved=` query parameter let a caller request unapproved rows. | P0 | Unauthenticated disclosure of PII and private financial/configuration data. **Fixed** — see below. |
| AUD-009 | Seller approval | OpenAPI documented that only approved sellers can create listings and promised 403 otherwise (`openapi.ts:421-458` at baseline), but `listingsService.create` checked only that a `Seller` row existed, not `isApproved` (`listings.service.ts:98-133`). | P0 | Pending/rejected sellers could publish purchasable inventory — a direct authorization gap and a documentation/implementation contradiction. **Fixed** — see below. |
| AUD-010 | Security | CORS, body limits, JWT-secret fail-closed production startup, webhook RSA/time/host verification, redaction, npm audit, and Trivy are present. | PASS | No additional production-path P0 beyond AUD-008/009. |
| AUD-011 | Rate limit / identity | `trust proxy = false`; Render uses the platform-overwritten single IP header and non-Render uses the socket peer (`clientIp.ts`, ADR 0023). | PASS | Current supported topology matches the stated guarantee. A shared counter across replicas remains future-scale only. |
| AUD-012 | PostgreSQL schema | BRL check, lifecycle enums, event/idempotency/refund/ledger uniqueness, ledger shape checks, FKs, and reconciliation indexes support the critical invariants. | PASS | No correctness-critical missing constraint found. |
| AUD-013 | Index/query safety | Reservation, payment reconciliation, refund, outbox, ledger, and cursor paths have appropriate current indexes and executable query-plan evidence. | PASS | Remaining OR/offset costs require measured scale, not PR11 work. |
| AUD-014 | Migrations | The full chain applies in CI; enum preflights refuse unknown labels; the BRL relabel and refund-ledger backfill have explicit accepted semantics and tests. | PASS | No material migration/data-safety defect found. |
| AUD-015 | API / audit contract | Generic `PATCH /listings/:id` accepted `price` and called `listingsService.update`, bypassing the transaction, `PriceHistory`, and `AuditLog` used by `/:id/price` (`listings.dto.ts:25-31`, `listings.service.ts:136-155` versus `158-225` at baseline). | P0 | ADR 0010 claims listing price changes are audited atomically; the focused test proved only one of two live price paths. **Fixed** — see below. |
| AUD-016 | OpenAPI / contract credibility | 53 route declarations existed but only 25 OpenAPI operations were documented. Missing sensitive paths included seller update/approval, listing cancel/reserve/price, order detail/tracking, reviews, users, and admin users/orders. The contract test checked only paths "used by contract tests" (`openapi.http.contract.test.ts:93-107` at baseline). `server/README.md` also had stale product-role and order-body claims. | P0 | The advertised "OpenAPI vs real HTTP handlers" gate was not actually proving the public surface. **Fixed** — see below. |
| AUD-017 | Test credibility | Real PostgreSQL suites fail closed and execute genuine in-test concurrency for reservation, confirm, webhook, refund, outbox, ledger, and constraints. | PASS | Strong core evidence; the previously missing regressions are now covered by AUD-001/005/008/009/015/016. |
| AUD-018 | CI credibility | Main CI runs frontend/backend lint/typecheck/tests, PostgreSQL migrations/integration, contract tests, builds, npm audit, and blocking Trivy. Load-test artifact steps are followed by explicit enforcement. | PASS | No ignored correctness/security gate found. |
| AUD-019 | Architecture boundaries | The executable module import graph matches ADR 0016; the Payments-owned PayPal gateway remains narrow and transaction ownership stays in services. | PASS | No architecture refactor justified. |
| AUD-020 | Payment-link failure recovery | A crash after a successful PayPal `OrdersCreate` but before local persistence leaves `PaymentLink.IN_PROGRESS`; subsequent calls return 409 indefinitely (`failure-modes.md:8-10`). | P1 | Disclosed availability/recovery limitation without captured funds. Frozen backlog / payment robustness; not a hidden P0. |
| AUD-021 | Capture reconciliation | The PayPal order sweep filters local `status=PENDING`; a capture never observed before expiry cancellation may fall outside automatic GET reconciliation (`payments.service.ts:406-441`). | P1 | Legitimate recovery-depth gap; destination is frozen backlog unless PR12 operational evidence elevates it. |
| AUD-022 | Reconciliation | Refund sweeps use durable eligibility, conditional claims, stable PayPal request IDs, bounded batches, trusted completion, and operator-required outcomes; the seller projection reconcile locks and `SET`s the ledger `SUM`. | PASS | No duplicate economic effect demonstrated. |
| AUD-023 | Outbox | Events share the payment transaction, claims use `SKIP LOCKED`, retries are bounded, stale processing is reclaimed, and docs do not claim exactly-once delivery. | PASS | Current log/metric consumer semantics are honest. |
| AUD-024 | Observability | Structured logs, request/trace IDs, spans, metrics, and health/readiness plus payment/refund/reconciliation signals exist; production OTLP/SLO observation is not proven. | P1 | PR12 owns production telemetry, SLI/SLO, and game-day proof. |
| AUD-025 | Operations | Runbooks cover deploy, rollback, migrations, payment/refund diagnosis, readiness, and operator boundaries. The Blueprint service name and the observed live Render service name differ; durable live proof remains external. | P1 | PR12 should reconcile service identity and production evidence; no runtime change belongs in PR11. |
| AUD-026 | Performance claims | The tracked report identifies SHA/run/artifacts, a 150-RPS 60-second hold, three repetitions, zero failures/drops, unstable 200 RPS, and the API-CPU boundary, explicitly not Render capacity. | PASS | Claims are evidence-bounded. |
| AUD-027 | Deployment claims | The active architecture consistently states Vercel SPA + Render API/PostgreSQL; AWS/ECS remains future-only. PR10 records bounded Vercel and live Render evidence. | PASS | No false current topology found. |
| AUD-028 | README / central payment claims | README/interview narrative correctly claimed implemented provider refunds, but `shared/money/policy.ts` (`MONEY_REFUNDS_IMPLEMENTED = false`), its unit test, and `docs/architecture/money-policy.md:65-78` still asserted that PayPal refund HTTP execution and `PaymentStatus.REFUNDED` writes were not implemented, while `refunds.service.ts` already did both. | P0 | Direct contradiction in a central portfolio story. **Fixed** — see below. |
| AUD-029 | README links | `python scripts/verify.py` passed; principal evidence targets and anchors resolve. | PASS | No credibility-critical broken navigation. |
| AUD-030 | Agent governance | Harness/adapter/`AGENTS.md` authority is coherent, but accepted historical artifacts retain removed `scripts/ai-factory` commands and one obsolete "orchestrator remains available" statement. | P1 | Frozen documentation backlog; historical evidence must stay labeled as history, not be rewritten as PR11 product work. |
| AUD-031 | Repository hygiene | No Lovable/Railway residue, active orchestrator runtime, duplicate ADR numbers, or stale active CODEOWNERS claim. Historical references are clearly identifiable as history. | PASS | No cleanup wave justified. |
| AUD-032 | Standalone reserve | Any authenticated caller can hold an `ACTIVE` listing without an order or `reservedByOrderId`; the threat model already discloses this (`listings.routes.ts:44-48`, `threat-model.md:163`). | P1 | Concrete inventory-griefing limitation, but disclosed and TTL-bounded. Frozen backlog; do not fold into the core order path silently. |
| AUD-033 | Account/seller composition | Email verification and seller application perform related `User`/`Seller`/pending/session writes without one transaction (`auth.service.ts:109-148`, `sellers.service.ts:25-46`). | P1 | Partial DB failure can leave a stuck onboarding state, but there is no auth bypass or money movement. Frozen backlog. |
| AUD-034 | Architecture proposals | Kafka, Kubernetes, microservices, CQRS/event sourcing, Redis-without-scale, service mesh, and an AWS rewrite would add no evidence for current needs. | P2 | Rejected as portfolio theater; future scale requires measurements and a new ADR. |

## Human policy gate

AUD-005, AUD-008, and AUD-009 required a human-approved interpretation of money,
public-data-exposure, and authorization policy before implementation (per the harness
spec/human-gate rule for material business behavior). The human approved a **minimal,
non-expanding** remediation for each, explicitly rejecting the assistant's own initial
(broader) recommendation of a new admin commission-management capability:

- **AUD-005**: no new commission-management capability in PR11. `commissionRate` is
  removed entirely from `applySellerDto` and `updateSellerDto`; new sellers get the
  existing Prisma schema default (`Seller.commissionRate @default(0.1)`). No
  `SELLER_COMMISSION_CHANGED` audit action and no admin commission-mutation endpoint
  were added. A dedicated admin commission-management capability remains frozen backlog.
- **AUD-008**: the public projection is exactly `{ id, storeName, rating, user: { id, name } }`
  — no `email`, `balance`, `commissionRate`, or `isApproved`. `GET /admin/sellers` is
  permitted **only** as security-remediation plumbing, because the existing admin UI
  already depended on the now-restricted public endpoint for full rows; it is not new
  product scope.
- **AUD-009** (uncontested but scoped alongside the others): enforce the OpenAPI-documented
  403 for an unapproved seller at listing creation; no additional seller-workflow change.

A second review pass added three mandatory corrections before implementation, all of
which are reflected in the code below: AUD-005 must not add any admin-facing commission
write path at all; AUD-008's projection must include `user.id` (not just `user.name`);
and AUD-015 must make a generic `PATCH /listings/:id` carrying `price` fail with an
explicit 400, not silently drop the field.

## P0 remediations

### AUD-001 — listing cancel vs. payment-confirm race

`listingsService.cancel` now guards the state transition with a conditional
`tx.listing.updateMany({ where: { id, status: { not: "SOLD" } }, data: { status: "CANCELED" } })`
inside the same transaction as the audit write ([`listings.service.ts`](../../server/src/modules/listings/listings.service.ts)).
If `count !== 1` the existing 400 `"Cannot cancel a SOLD listing"` is thrown. The
pre-transaction ownership/existence read remains authorization-only; it is never the
correctness mechanism.

Regression evidence:
- `server/src/__tests__/reservation.lifecycle.integration.test.ts` — `AUD-001: racing cancel
  against a concurrent payment confirmation never produces a paid order with a canceled
  listing, or a sold listing whose order never reached PAID` races
  `paymentsService.confirmPayment` against `listingsService.cancel` on the same reservation
  over real PostgreSQL via `Promise.allSettled`, across six independent trials (fresh
  listing/order each time), without forcing a winner. The actual safety invariant is: a
  listing that has successfully transitioned to `SOLD` must never subsequently be overwritten
  to `CANCELED` by cancellation. Both transactions guard the same row with mutually exclusive
  conditional updates (payment: `status=RESERVED → SOLD`; cancel: `status≠SOLD → CANCELED`),
  so real PostgreSQL row-level locking admits exactly two legal outcomes depending on which
  transaction's `UPDATE` commits first, and the test asserts both:
  - **Payment commits first** — the listing ends `SOLD`, its order is `PAID`/`CONFIRMED` in the
    same transaction, and cancel's guarded `updateMany` then observes `status=SOLD` and
    rejects with the existing `400 "Cannot cancel a SOLD listing"`.
  - **Cancel commits first** — the listing ends `CANCELED`; payment's conditional
    `status=RESERVED` listing update then matches nothing, so that mismatch throws *inside*
    payment's own transaction, rolling back its own order claim (the order stays
    `PENDING`/`PENDING`) with the same `409 "Reservation expired or listing is no longer
    reserved"` failure already proven for the expiry-vs-payment race above — the compensation
    semantics for this outcome are not re-derived here.

  In both outcomes the test additionally asserts the forbidden state never occurs: no trial
  may end with `listing.status === "CANCELED" && order.paymentStatus === "PAID"`, and no trial
  may end with `listing.status === "SOLD" && order.paymentStatus !== "PAID"`. This replaces an
  earlier version of this test/artifact that incorrectly asserted payment must always win
  regardless of scheduling order — that assertion was stronger than the actual domain
  invariant and was corrected during PR11 review before merge. A sequential
  `rejects cancelling a listing that a payment confirmed moments earlier` regression remains
  unchanged.
- `server/src/modules/listings/__tests__/listings.invariants.test.ts` and
  `listings.audit.test.ts` updated to assert the conditional `updateMany` call, not the
  removed unconditional `update`.
- `docs/domain/invariants.md` — `INV-LISTING-SOLD-IRREVERSIBLE` updated to describe the
  guard and the new race test.

### AUD-005 — caller-controlled commission rate

`commissionRate` was removed entirely from `applySellerDto` and `updateSellerDto`
([`sellers.dto.ts`](../../server/src/modules/sellers/sellers.dto.ts)); the corresponding
references were dropped from `sellersService.apply()` and the seller-creation path in
`authService` (email-verification seller signup). New sellers get the Prisma schema
default (`0.1`); no current API surface (seller or ADMIN) can set or change the rate.

Regression evidence:
- `server/src/__tests__/sellers.public.integration.test.ts` — `AUD-005: POST /sellers/apply
  ignores a caller-supplied commissionRate` and `AUD-005: PATCH /sellers/:id ignores a
  caller-supplied commissionRate for the owning seller`, both over real PostgreSQL.
- `server/src/modules/sellers/__tests__/sellers.service.test.ts` — unit regression proving
  `prisma.seller.create` is never called with a `commissionRate` key even when a bypass
  attempt reaches the service directly.
- `docs/domain/invariants.md` — commission section states the rate is fixed at the schema
  default and notes the frozen-backlog admin commission-management item.

### AUD-008 — public seller endpoints leaking PII/financial data

`sellersService.listPublic()` / `getPublicById()` return exactly
`{ id, storeName, rating, user: { id, name } | null }` for unauthenticated callers, always
forcing `isApproved: true` server-side (no client-controlled filter); `getPublicById`
returns 404 for a pending/rejected/missing seller so the endpoint cannot be used to
enumerate non-approved sellers. `GET /admin/sellers` (ADMIN-only) was added purely as
remediation plumbing so the existing admin management screens keep full-row access after
the public leak closed ([`sellers.service.ts`](../../server/src/modules/sellers/sellers.service.ts),
[`sellers.controller.ts`](../../server/src/modules/sellers/sellers.controller.ts),
[`admin.routes.ts`](../../server/src/modules/admin/admin.routes.ts)). The frontend
(`src/api/sellers.ts`, new `src/api/admin.ts#listAdminSellers`, `Index.tsx`,
`AdminDashboard.tsx`, `AdminSellers.tsx`) was repointed accordingly, with a new
`PublicSeller` type in `src/types/api.ts`.

Regression evidence:
- `server/src/__tests__/sellers.public.integration.test.ts` — asserts the exact key set
  (`["id","rating","storeName","user"]`, nested `["id","name"]`) on `GET /sellers`, an
  approved seller never includes a pending one, `GET /sellers/:id` 404s for a pending
  seller, and `GET /admin/sellers` is 401 anonymous / 403 SELLER / 200 with full rows
  (including `commissionRate` and pending sellers) for ADMIN.
- `server/src/modules/sellers/__tests__/sellers.service.test.ts` — unit coverage for
  `listPublic()`/`getPublicById()` never exposing `email`/`balance`/`commissionRate`.
- Frontend: `src/api/__tests__/sellers.test.ts`, `AdminDashboard.test.tsx`,
  `AdminSellers.test.tsx`, `Index.test.tsx` updated to the new client shapes/endpoints.

### AUD-009 — listing creation bypassing seller approval

`listingsService.create` now throws `403 "Seller is not approved"` when the seller's
`isApproved` is false, matching the pre-existing OpenAPI documentation
([`listings.service.ts`](../../server/src/modules/listings/listings.service.ts)).

Regression evidence:
- `server/src/modules/listings/__tests__/listings.create.test.ts` — new unit suite:
  pending seller → 403 (repository never called), approved seller → success, and no
  seller row at all still 404.

### AUD-015 — duplicate unaudited listing price path

`updateListingDto` no longer has a `price` field and is `.strict()`, so a `price` key on
`PATCH /listings/:id` is rejected outright with 400 instead of being silently stripped
([`listings.dto.ts`](../../server/src/modules/listings/listings.dto.ts)). The dead `price`
branch was removed from `listingsService.update()`. `PATCH /listings/:id/price` remains
the only path that can move `Listing.price`, still atomic with `PriceHistory` and
`AuditLog`.

Regression evidence:
- `server/src/__tests__/listings.price.integration.test.ts` — new PostgreSQL suite:
  generic `PATCH /listings/:id` with `price` returns 400 and leaves `Listing.price`,
  `PriceHistory`, and `AuditLog` unchanged; `PATCH /listings/:id/price` still updates all
  three atomically.
- `server/src/modules/listings/__tests__/listings.security.test.ts`,
  `listings.invariants.test.ts`, `server/src/__tests__/api.security.integration.test.ts`,
  `server/src/shared/domain/__tests__/invariants.property.test.ts`, and
  `server/src/shared/validation/__tests__/httpLimits.test.ts` updated to assert rejection
  (not silent stripping) and to use `tradeLockUntil` where the test's intent is ownership,
  not body validation.

### AUD-016 — incomplete OpenAPI route inventory

`server/src/app.ts` now mounts routers from a single `apiModules` manifest array (no
behavior change — same routers, same prefixes, same order); a new
[`shared/docs/routeInventory.ts`](../../server/src/shared/docs/routeInventory.ts) walks
each router's own `.stack` to recover the literal `METHOD /path` operations it registers,
normalizing Express `:param` to OpenAPI's `{param}`, and documents its own flat-router
assumption instead of silently pretending completeness for a future nested router.
`server/src/shared/docs/openapi.ts` now documents the full real surface (all 53 routes:
users, sellers list/getById/me/apply/update/approve, products CRUD, listings
create/list/getById/update/price/reserve/mark-sold/cancel/seller-my-listings/price-history,
orders list/create/getById/status/tracking, payments, reviews CRUD, favorites, and admin
users/orders/sellers/audit-logs/catalog-import), at the same schema/security/status-code
detail level as the pre-existing entries. `server/README.md` was corrected: the order body
is `items: [{ listingId }]` (not `productId, quantity`), and the sellers/listings rows now
reflect the AUD-005/008/009 auth policy.

Regression evidence:
- `server/src/__tests__/openapi.http.contract.test.ts` — replaced the old "documents every
  implemented public operation used by contract tests" partial check (a fixed 10-path
  allowlist) with an exact-match assertion: the manifest-derived operation set
  (`healthRoutes` + `apiModules`, walked by `listManifestOperations`) must equal the
  flattened `openApiSpec.paths` methods. No route can drift silently undocumented, and no
  documented path can reference a route that no longer exists.

### AUD-028 — dead false "refunds not implemented" flag

`MONEY_REFUNDS_IMPLEMENTED = false` and its unit test were removed from
[`shared/money/policy.ts`](../../server/src/shared/money/policy.ts); no other caller
depended on the flag. `docs/architecture/money-policy.md` now states that PayPal refund
HTTP execution and `PaymentStatus.REFUNDED` writes are implemented, matching
`refunds.service.ts`'s actual behavior (already true before this PR — only the stale flag
and doc contradicted it).

Regression evidence:
- `server/src/shared/money/__tests__/policy.test.ts` — the obsolete
  `does not implement refund math` assertion on the removed flag was deleted; no test
  claims refunds are unimplemented.

## P1 handoff

| ID | Destination |
|---|---|
| AUD-002 | Frozen backlog — cancellation/refund policy for CUSTOMER-canceled `CONFIRMED` orders |
| AUD-020 | Frozen backlog / payment robustness — `PaymentLink.IN_PROGRESS` stuck-claim recovery |
| AUD-021 | Frozen backlog, or PR12 if operational evidence elevates it — capture reconciliation sweep filter |
| AUD-024 | PR12 — production OTLP/SLO/game-day observability proof |
| AUD-025 | PR12 — Render service-identity reconciliation and live operational evidence |
| AUD-030 | Frozen documentation backlog — stale `scripts/ai-factory` references in historical artifacts |
| AUD-032 | Frozen backlog — standalone reservation inventory-griefing hardening |
| AUD-033 | Frozen backlog — single-transaction email-verification/seller-application composition |

## P2 rejection rationale

AUD-034 rejects Kafka, Kubernetes, microservice extraction, CQRS/event sourcing,
Redis-without-measured-need, service mesh, and an AWS/Terraform rewrite. None of these
technologies solve a demonstrated problem in this repository; ADR 0007 (Render) and ADR
0016 (modular monolith) remain authoritative until a concrete, measured requirement and a
new human-approved ADR supersede them. Adding any of them now would be portfolio theater,
not additional Senior Backend evidence.

## Local verification

- `python scripts/verify.py`: **PASS** (documentation contract validation + 19 validator
  tests).
- Backend (`server/`):
  - `npm run lint`: **PASS**, 0 errors.
  - `npx tsc --noEmit`: **PASS**.
  - `npm run test:unit`: **PASS** — 73 files, 440 tests.
  - `npm run test:contract`: **PASS** — 1 file, 19 tests, including the new AUD-016 exact
    route-inventory-vs-OpenAPI assertion.
  - `npm run test:integration` (real PostgreSQL, `postgres:16-alpine`): **PASS** — 28
    files, 176 tests, including the new AUD-001 concurrent cancel-vs-confirm race,
    AUD-005/008 public-seller-surface suite, and AUD-015 price-mutation-path suite.
- Frontend (repo root):
  - `npm run lint`: **PASS**, 0 errors (12 pre-existing `react-refresh` warnings,
    unrelated to this change).
  - `npx tsc --noEmit -p tsconfig.app.json`: **PASS**.
  - `npx vitest run`: **PASS** — 76 files, 449 tests.

## Remote CI

[PR #260](https://github.com/Bruno2K/neon-arsenal-market/pull/260), head
`252d9c6049323869c42502385dd35462ef9c1c1e`. All checks **PASS**:

- Agent harness and documentation contracts
- Backend (lint · typecheck · unit · integration) — 1m48s
- Contract (OpenAPI)
- Documentation contracts
- Frontend (lint · typecheck · test)
- Security (Trivy High/Critical gate)
- Security (npm audit)
- Build check
- Vercel preview deployment

Baseline `main` CI and repository-verification runs are linked above under
Authorization and scope.

## Residual risks

- The seven P0 fixes are scoped exactly to close the confirmed gap; they do not add a
  commission-management UI, a broader admin data model, or any new business workflow.
  Any future admin commission-management capability, standalone-reserve hardening, or
  onboarding-transaction consolidation requires its own Specification.
- AUD-016's OpenAPI completion is documentation-only against already-existing, already-
  tested route behavior; it does not change any handler's runtime behavior.
- PR12 remains the owner of production/operational proof (AUD-024, AUD-025, and possibly
  AUD-021 if elevated by later operational evidence). PR13 remains the owner of portfolio
  packaging and release. Neither is touched by this PR.

## Engineering memory

Independent audit passes on the same repository can converge on "P0 count = 0" while
missing alternate public paths into the same domain object (a second listing-update route,
a second seller-mutation route, an unenforced-but-documented approval gate). Re-deriving
every route that can reach a sensitive field or state transition — not just the primary
documented one — is what actually falsifies a "no P0" conclusion for correctness/security
dimensions.
