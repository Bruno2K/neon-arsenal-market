# ADR 0022 — Use BRL as the single checkout currency

## Status

Accepted

## Context

PayPal capture and the seller ledger already use BRL, but Listing accepted arbitrary currency labels and defaulted to USD. The cs2.sh catalog integration also copied a USD reference ask into demo Listing.price, which checkout then sent to PayPal as BRL. There is no FX rate or conversion contract.

## Decision

1. BRL is the only currency for Listing.price, order snapshots/totals, PayPal capture, and seller-ledger amounts.
2. The API accepts omitted currency or literal `BRL`; PostgreSQL enforces the same invariant.
3. Existing Listing numeric values are preserved and relabeled BRL because BRL was already their effective checkout currency.
4. `Product.referencePriceUsd` remains reference-only. cs2.sh import updates Product catalog data and does not create sellable listings from USD values.
5. The hand-seeded portfolio storefront provides explicit BRL demo listings independently of cs2.sh reference prices.

## Consequences

- Stale clients sending USD receive 400 instead of creating a misleading listing.
- The application has no FX dependency, rounding ambiguity, or mixed-currency order.
- Imported catalog coverage no longer implies invented seller inventory.
- Multi-currency support requires a new Specification covering conversion, snapshots, settlement, refund, reconciliation, and provider support.

## Migration and rollback

The forward migration relabels existing Listing rows as BRL without changing Decimal prices, changes the default, and adds a database check. Rollback would require a new forward migration and cannot reconstruct historical labels because those labels never governed checkout behavior.

## Supersedes

This ADR supersedes ADR 0014 decision 1 only for cs2.sh-created demo listings and decision 3 where it allowed Listing currency USD. It also supersedes ADR 0011's characterization of Listing.currency as unrelated catalog metadata.
