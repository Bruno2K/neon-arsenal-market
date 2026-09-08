---
id: SPEC-0011
status: Accepted
version: 1
owner: Bruno
created: 2026-09-08
updated: 2026-09-08
---

# [SPEC-0011] — Single checkout currency

## Status

Accepted. The owner authorized the P0 currency-contract correction. This Specification records the existing product decision that checkout and seller settlement use BRL.

## Problem

`Listing.currency` defaults to USD and the seller UI accepts USD or BRL, while order snapshots, PayPal capture, and the seller ledger always interpret the numeric listing price as BRL. The cs2.sh importer also copies a USD reference ask into a sellable listing before checkout treats that number as BRL. A buyer can therefore see one currency and be charged another.

## Goal

Make BRL the only sellable listing, order, PayPal, and ledger currency. Keep cs2.sh USD values isolated as non-checkout product reference data.

## Actors

- Seller creating or repricing a listing.
- Buyer browsing, carting, and paying for a listing.
- Administrator importing catalog reference data.
- Operator applying the forward database migration.

## Scope

- Listing creation contract and persistence constraint.
- Existing listing currency data and default.
- Checkout-price presentation in the web client.
- cs2.sh catalog import boundary.
- OpenAPI, money policy, invariants, ADRs, seeds, and regression evidence.

## Non-goals

- Foreign exchange, exchange-rate storage, or currency conversion.
- Multi-currency checkout or seller settlement.
- Changing numeric prices during migration.
- Changing PayPal capture, commission, refund, or ledger arithmetic.
- Removing `Product.referencePriceUsd`.

## Business Rules

- `BR-01`: Every sellable `Listing.price` is denominated in BRL.
- `BR-02`: Omitted listing currency defaults to BRL; an explicitly supplied non-BRL currency is rejected.
- `BR-03`: PostgreSQL rejects a non-BRL listing even when application validation is bypassed.
- `BR-04`: Existing listing decimals are preserved and their currency label is corrected to BRL because BRL was already the effective checkout and settlement currency.
- `BR-05`: cs2.sh USD asks remain only in `Product.referencePriceUsd`; catalog import must not copy them into sellable listings.
- `BR-06`: Buyer, seller, and administrator checkout-price surfaces identify amounts as BRL.

## Invariants

- `INV-LISTING-CHECKOUT-CURRENCY`: every Listing currency is BRL and every downstream order/payment/ledger amount preserves that denomination.
- `INV-ORDER-PRICE-SNAPSHOT`: item prices remain immutable Decimal snapshots of the reserved listing price.
- `INV-SELLER-LEDGER-SOURCE`: the BRL seller ledger remains authoritative for balances.

## State Transitions

No lifecycle transition changes. Currency cannot transition after listing creation.

## API / Data Contract

- `POST /listings` accepts an omitted `currency` or the literal `BRL`.
- An explicit `currency` other than `BRL` returns HTTP 400 through existing Zod validation.
- Listing responses retain `currency`, now constrained to `BRL`.
- `Product.referencePriceUsd` remains nullable USD reference metadata and never becomes a checkout input.

## Concurrency Model

The migration updates existing currency labels and adds the constraint in one PostgreSQL migration transaction. It does not alter prices, reservations, orders, or payment state. Normal listing and checkout concurrency controls remain unchanged.

## Failure Modes

- A stale client sends `USD`: reject before persistence.
- A direct database writer sends non-BRL: reject with the database check constraint.
- The cs2.sh provider returns USD data: store it only as product reference data.
- Migration encounters historical non-BRL values: relabel them to the already effective BRL checkout denomination without changing Decimal amounts, then install the constraint.

## Security

Fail closed on unsupported currency. Do not accept a client-provided label that disagrees with the trusted payment currency, and do not introduce an external FX dependency.

## Observability

Existing validation error telemetry covers rejected API inputs. Migration and integration-test evidence prove database enforcement. No new metric is required for a single allowed value.

## Backward Compatibility

Clients omitting currency continue to work and now receive BRL. Clients explicitly sending BRL continue to work. Clients sending USD or another value receive 400; this intentional incompatibility prevents a misleading charge. Existing numeric amounts are not converted or rounded.

## Acceptance Criteria

- [x] `AC-01` Listing creation defaults to BRL and rejects every explicit non-BRL value. **Evidence:** test
- [x] `AC-02` PostgreSQL defaults and constrains every Listing currency to BRL after relabeling existing rows without changing prices. **Evidence:** integration
- [x] `AC-03` PayPal, order snapshots, and seller-ledger amounts remain BRL under the existing Decimal policy. **Evidence:** test
- [x] `AC-04` cs2.sh import stores USD only as Product reference data and creates no sellable listing from that value. **Evidence:** integration
- [x] `AC-05` Web price surfaces and seller input identify checkout amounts as BRL and do not offer USD. **Evidence:** test
- [ ] `AC-06` OpenAPI, invariants, ADRs, schema, and operational documentation describe the same contract in remote CI. **Evidence:** static check

## Verification Strategy

- Unit-test the Zod currency boundary and client formatting.
- Run focused listing-form and display tests.
- Run PostgreSQL constraint and cs2.sh import integration tests.
- Run server unit, integration, contract, typecheck, and build checks plus frontend lint, typecheck, tests, and build.
- Validate documentation contracts and inspect the migration/diff.

## Decisions / References

- `docs/architecture/money-policy.md`
- `docs/adr/0011-seller-ledger.md`
- `docs/adr/0014-cs2sh-catalog-import.md`
- `docs/adr/0022-single-checkout-currency.md`

## Traceability

SPEC → PLAN → TASK(S) → PR → EVIDENCE

- Specification: `SPEC-0011` v1
- Plan: `PLAN-0010` v1
- Task: `TASK-0011` v1
- PR: pending
- Evidence: `docs/verification/single-checkout-currency.md` plus CI

## Change History

- 2026-09-08 — v1 accepted: close the USD-label/BRL-charge mismatch without introducing FX.
