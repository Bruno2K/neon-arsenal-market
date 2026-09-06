---
id: SPEC-0006
status: Accepted
version: 1
source_issue: "#59"
owner: "Neon Arsenal Engineering"
created: 2026-09-06
updated: 2026-09-06
---

# [SPEC-0006] — Explicit modular monolith boundaries

## Status

`Accepted`

This Specification authorizes documenting and enforcing in-process module boundaries. It does not change marketplace business behavior, public HTTP contracts, payment semantics, or the PostgreSQL schema.

## Problem

The backend already lives under `server/src/modules/*`, but the logical modules named by issue #59 (Auth, Users, Sellers, Catalog, Listings, Orders, Payments, Ledger, Reviews, Admin) are not mapped, dependency rules are not written down, and nothing fails when one module imports another module's internals. That makes the modular monolith implicit and easy to erode.

## Goal

Make the modular monolith explicit: every named domain module has a folder, owner, and allowed dependency set. Production source must not import another module except on a documented edge. Enforcement is a unit test over the existing folder tree, not a new runtime or microservice split.

## Actors

- Backend agent implementing or reviewing `server/` changes
- Verification agent running unit and integration suites
- Express composition root (`app.ts`) and in-process jobs
- PostgreSQL as the transactional source of truth

## Scope

- Map logical module names to existing folders (`products` = Catalog, `commissions` = Ledger).
- Document allowed module-to-module imports and composition-root exceptions.
- Document that cross-table Prisma writes remain allowed only for named transactional workflows.
- Enforce the import graph with a machine-readable contract and a unit test.
- Record why Payments is not split into application/domain/infrastructure in this change.

## Non-goals

- Renaming `products` or `commissions` folders.
- Introducing microservices, Redis, Kafka, RabbitMQ, SQS, or extra processes.
- Changing PayPal contracts, refunds, retries of `OrdersCreate` / `OrdersCapture`, or environment variables.
- Changing authentication, authorization, CORS, rate limits, or public API shapes.
- Schema or migration changes.
- Splitting `payments.service.ts` unless a later Specification proves that layering reduces risk without breaking `confirmPayment` atomicity.
- Moving Prisma access out of services as a repository rewrite.

## Business Rules

- `BR-01`: The deployable remains one Express process plus PostgreSQL. Module boundaries are in-process.
- `BR-02`: Logical modules are Auth, Users, Sellers, Catalog, Listings, Orders, Payments, Ledger, Reviews, and Admin. Catalog is implemented as `modules/products`. Ledger is implemented as `modules/commissions`. Audit is a supporting module, not a marketplace domain.
- `BR-03`: Production files under `server/src/modules/<name>/` may import their own module and `server/src/shared/`. They may import another module only when that edge is listed in the allowed graph.
- `BR-04`: Admin is a composition module. It may import Sellers, Orders, Catalog (`products`), and Audit for ADMIN HTTP use cases already implemented.
- `BR-05`: Mutating domain modules that already write `AuditLog` may import Audit. New domain-to-domain service imports are forbidden.
- `BR-06`: `app.ts` and documented in-process jobs are composition roots. They may import the module services or routes they already orchestrate. Other `shared/` production files must not import `modules/`.
- `BR-07`: A single PostgreSQL transaction may write tables owned by more than one module when the write is a named workflow (order create + reserve; payment confirm + sell + ledger + outbox; payment-link claim). That is not permission to import the other module's service.
- `BR-08`: Payments stays one application service. PayPal HTTP already lives in `shared/utils`. `confirmPayment` remains one local transaction. An application/domain/infrastructure split is out of scope until complexity is shown to justify it without weakening payment invariants.
- `BR-09`: Tests and scripts may import any module. Enforcement applies to production source.

## Invariants

This Specification does not add or redefine domain invariants. The import graph must not weaken:

- `INV-LISTING-EXCLUSIVE-RESERVE`
- `INV-LISTING-SOLD-IRREVERSIBLE`
- `INV-LISTING-RESERVATION-TTL`
- `INV-ORDER-ATOMIC-CREATE`
- `INV-ORDER-IDEMPOTENCY`
- `INV-PAYMENT-TRUSTED-CONFIRM`
- `INV-PAYMENT-WEBHOOK-IDEMPOTENT`
- `INV-PAYMENT-LINK-IDEMPOTENT`
- `INV-SELLER-LEDGER-SOURCE`
- `INV-SELLER-TXN-UNIQUE`
- `INV-AUTH-OWNERSHIP`
- `INV-AUDIT-APPEND-ONLY`

## State Transitions

No listing, order, payment, or seller-ledger transition changes.

Module membership is static. Adding a new domain folder requires updating the machine-readable graph in the same change.

## API / Data Contract

No public HTTP, webhook, or Prisma schema change.

The internal contract is `server/src/shared/architecture/moduleBoundaries.ts`:

- folder ↔ logical name
- allowed module edges
- composition-root exceptions

Documentation in `docs/architecture/modular-monolith.md` must match that file.

## Concurrency Model

Import enforcement is a static unit test. It does not participate in request concurrency.

Named cross-table transactions stay the concurrency boundary for reservation, payment confirmation, and ledger writes. This Specification must not move those writes behind service calls that run outside the existing transaction.

## Failure Modes

- A forbidden production import is added: the module-boundary unit test fails.
- The documented graph and the TypeScript contract disagree: the unit test or review fails; the TypeScript file wins until docs are updated.
- A future Payments split that extracts `confirmPayment` collaborators incorrectly: payment confirmation could lose atomicity. That split is rejected here.
- Process crash, webhook duplicate, and PayPal timeout behavior are unchanged and remain owned by existing payment/reliability ADRs.

## Security

- Authentication, authorization, CORS, rate limits, and webhook signature verification stay in their current modules and shared middleware.
- The graph must not let a customer-facing module import Admin internals.
- Audit remains append-only and ADMIN-readable. Importing Audit is not permission to read the trail from non-Admin modules.

## Observability

No new metrics or spans. Existing payment, reservation, ledger, and outbox signals stay in their current services.

## Backward Compatibility

Additive documentation and a failing-closed unit test. Existing clients, migrations, and Render topology are unchanged. Folder names stay `products` and `commissions` so HTTP mounts (`/products`, `/commissions`) do not move.

## Acceptance Criteria

- [ ] `AC-01` — Auth, Users, Sellers, Catalog, Listings, Orders, Payments, Ledger, Reviews, and Admin are mapped to existing `server/src/modules/*` folders, including Catalog=`products` and Ledger=`commissions`. **Evidence:** test
- [ ] `AC-02` — Allowed production module-to-module imports are documented and encoded in `moduleBoundaries.ts`. **Evidence:** test
- [ ] `AC-03` — A production import that is not an allowed edge fails the unit test. **Evidence:** test
- [ ] `AC-04` — Current production source on this branch satisfies the allowed graph (no drive-by import rewrites required). **Evidence:** test
- [ ] `AC-05` — Payments is not split into application/domain/infrastructure in this change; the decision is recorded in the ADR. **Evidence:** manual review
- [ ] `AC-06` — Public API, authz, CORS, rate limits, PayPal contracts, and schema are unchanged. **Evidence:** integration

## Verification Strategy

- Required commands: `cd server && npm run test:unit`; `cd server && npm run test:integration`; `python3 scripts/ai-factory/validate.py`
- Unit tests: module-boundary graph + negative forbidden-import case
- Integration tests: existing reservation/payment/ledger suites prove behavior did not change
- Security/contract checks: no auth, CORS, rate-limit, or OpenAPI edits
- Runtime/manual checks: inspect the diff for `src/` edits and Payments layering
- Required external evidence: none (no provider contract change)

The final implementation must be traceable from each material acceptance criterion to evidence.

## Decisions / References

- Issue `#59`
- `docs/architecture/current-state.md`
- `docs/architecture/c4.md`
- `docs/architecture/domain-invariants.md`
- `docs/adr/0016-modular-monolith-boundaries.md`
- `docs/adr/0007-cloud-target-render.md`
- `docs/adr/0011-seller-ledger.md`
- `docs/architecture/ai-engineering-authority.md`

## Traceability

Material changes must preserve this chain:

```text
GitHub Issue → SPEC → PLAN → TASK(S) → PR → VERIFICATION/CONVERGENCE → EVALUATION → MEMORY
```

### Traceability metadata

- Issue: `#59`
- Spec: `SPEC-0006`
- Plan: `PLAN-0003`
- Tasks: `TASK-0006`
- PR: pending
- Verification/Convergence: pending
- Evaluation: pending F5
- Memory: pending F6

## Change History

- `v1` — Initial accepted modular-monolith boundary contract — 2026-09-06
