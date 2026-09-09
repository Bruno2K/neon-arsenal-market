# Monetary policy

Canonical contract for currency, scale, precision, and rounding. Code lives in
`server/src/shared/money/policy.ts` and `server/src/shared/money/sellerLedger.ts`.

This document **formalizes the existing scheme**. It does not introduce banker's
rounding, integer cents, FX, or a refund API.

## Currency

| Store | Currency | Notes |
|---|---|---|
| PayPal `OrdersCreate` / capture | **BRL** | `MONEY_CURRENCY` |
| `Refund.amount`, `SellerTransaction` amounts | **BRL** | Same as PayPal capture |
| `Order.totalAmount`, `OrderItem.priceSnapshot`, `Listing.price` | **BRL** | Snapshot is copied as-is |
| `Listing.currency` | **BRL only** | API literal + PostgreSQL CHECK (ADR 0022) |
| `Product.referencePriceUsd` | USD ask (cs2.sh) | Display/reference only (ADR 0014) |

There is no second checkout currency and no FX conversion in application code. A
cs2.sh USD reference must never become a sellable listing price automatically.

## Scale and precision

- Listing prices, order totals, and PayPal `amount.value` use **2 decimal places**.
- Prisma/`Decimal.js` stores exact decimal values. PostgreSQL `Decimal` columns
  are the durable representation.
- Commission is `gross × seller.commissionRate`. The product may have **more
  than 2** fractional digits when the rate is not a terminating hundredth
  (example: `1.00 × 0.083 = 0.083`). Those extra digits are kept.
- `Seller.balance` is a projection of PAID `netAmount` and therefore inherits
  that same exact Decimal scale.

Never use JavaScript `number` for price, commission, net, or balance arithmetic.

## Rounding mode

There is **one** rounding boundary:

1. **Ledger / order math — no extra rounding.**
   `sumMoney`, `aggregateGrossBySeller`, and `computeSellerLedgerAmounts` use
   exact Decimal `plus` / `mul` / `minus`.
   `MONEY_COMMISSION_ROUNDING = "exact"`.
2. **PayPal wire — Decimal.js `toFixed(2)` (ROUND_HALF_UP).**
   `formatPayPalAmount` is the only formatter. Commission and net are never
   passed through it. `MONEY_PAYPAL_ROUNDING = "HALF_UP"`.

Do not add a third step (banker's rounding, `Math.round`, or integer cents).

## Deterministic identities

```text
Order.totalAmount          = Σ OrderItem.priceSnapshot
sellerGross                = Σ priceSnapshot for that seller in the order
commission                 = sellerGross × seller.commissionRate
net                        = sellerGross − commission
Seller.balance (projection) = Σ PAID SellerTransaction.netAmount
refund compensation         = exact signed inverse of original seller credit
```

`net = gross − commission` is also a PostgreSQL CHECK on `SellerTransaction`.
Credit amounts are non-negative; compensation amounts are non-positive. The
inverse uses Decimal `negated()` without adding a rounding boundary.

## Refunds

`MONEY_REFUNDS_IMPLEMENTED = false` continues to mean that PayPal refund HTTP
execution is not implemented. TASK-0013 adds a durable full-BRL `Refund`
obligation and local append-only seller compensation only; it does not invoke
PayPal or write `PaymentStatus.REFUNDED`.

`Refund.amount` must be positive, have at most two decimal places, and equal the
order's full BRL total when the obligation is created. Partial and commercial
refund semantics remain out of scope. When a credited seller is compensated,
gross, commission, and net are exact signed inverses of the original movement.

## Ownership

| Operation | Helper | Caller |
|---|---|---|
| Sum item snapshots | `sumMoney` | `ordersService.create` |
| Format PayPal amount | `formatPayPalAmount` | `paymentsService.createPaymentLink` |
| Group seller gross | `aggregateGrossBySeller` | `paymentsService.confirmPayment` |
| Commission and net | `computeSellerLedgerAmounts` | `paymentsService.confirmPayment` |

Services must not re-implement these identities inline.

## Related

- `docs/adr/0011-seller-ledger.md`
- `docs/adr/0022-single-checkout-currency.md`
- `INV-ORDER-TOTAL-COMPOSITION`, `INV-SELLER-COMMISSION-DECIMAL`, `INV-SELLER-LEDGER-SOURCE`
