# Verification — single BRL checkout currency

## Authority

- Specification: `SPEC-0011`
- Plan: `PLAN-0010`
- Task: `TASK-0011`
- Architecture decision: `ADR-0022`
- Invariant: `INV-LISTING-CHECKOUT-CURRENCY`

## Acceptance evidence

- Listing input defaults an omitted currency to BRL and rejects USD.
- PostgreSQL defaults `Listing.currency` to BRL and rejects non-BRL writes with
  `Listing_currency_brl_chk`.
- The forward migration relabels existing listing rows as BRL without changing
  numeric amounts before installing the constraint.
- cs2.sh imports update `Product.referencePriceUsd` but create zero listings.
- Seller input and buyer-facing monetary labels expose the BRL contract.

## Executed checks

- `npm run typecheck` — PASS.
- `npm run typecheck --prefix server` — PASS.
- `npm test -- --run --reporter=dot` — PASS, 76 files / 449 tests.
- `npm run test:unit --prefix server -- --reporter=dot` — PASS, 68 files / 404 tests.
- `npm run test:contract --prefix server -- --reporter=dot` — PASS, 1 file / 19 tests.
- `npm run db:generate --prefix server` — PASS.
- `npm run db:migrate:deploy --prefix server` against PostgreSQL 16 — PASS, all 16 migrations including `20260908160000_single_checkout_currency_brl`.
- `npm run test:integration --prefix server -- --reporter=dot` against PostgreSQL 16 — PASS, 23 files / 133 tests.
- `npm run lint` — PASS with 12 pre-existing Fast Refresh warnings and zero errors.
- `npm run build` with the documented `API_URL` — PASS.
- `npm run build --prefix server` — PASS.
- `python scripts/docs/validate_contracts.py` — PASS.
- `python tests/tooling/test_docs_contracts.py` — PASS, 19 tests.
- `git diff --check` — PASS.

## Convergence evaluation

- Specification / acceptance fidelity: 2/2 — API, database, importer, UI, and documentation share one explicit contract.
- Correctness / invariants / failure behavior: 2/2 — both boundary validation and a database CHECK protect the invariant.
- Security / governance: 2/2 — no payment trust boundary or secret handling changed; misleading cross-currency checkout is removed.
- Architecture / scope discipline: 2/2 — no FX subsystem was invented; external USD stays catalog-only.
- Verification / operational evidence: 2/2 — migration and full PostgreSQL integration suite ran on a clean temporary database.
- Total: 10/10.

## AgentOps note

The first integration attempt exposed a stale generated Prisma client whose
embedded schema still defaulted listings to USD. Regenerating the client before
the suite made the runtime match the checked-in schema; the full integration
suite then passed. This is why CI must keep Prisma generation before tests.

## Remaining risk and rollback

The data migration intentionally relabels existing numeric listing amounts as
BRL because the existing payment and ledger path already charged those values as
BRL; it performs no invented FX conversion. Rollback requires a forward
migration that removes the CHECK and explicitly selects any replacement currency
policy before accepting non-BRL listings.
