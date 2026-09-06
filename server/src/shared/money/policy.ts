import { Prisma } from "@prisma/client";

/**
 * Canonical monetary policy for checkout, PayPal capture, and the seller ledger.
 *
 * Services must import helpers from this module (and `computeSellerLedgerAmounts`)
 * instead of inventing a second rounding scheme, integer-cent conversion, or
 * JavaScript `number` arithmetic. See `docs/architecture/money-policy.md`.
 */

/** PayPal OrdersCreate / SellerTransaction currency. Not `Listing.currency`. */
export const MONEY_CURRENCY = "BRL" as const;

/** Scale for listing prices, order totals, and PayPal capture amounts. */
export const MONEY_PRICE_SCALE = 2;

/**
 * Commission / net rounding: none. `commission = gross × rate` is exact
 * Decimal.js multiplication. Extra fractional digits from the rate are kept.
 */
export const MONEY_COMMISSION_ROUNDING = "exact" as const;

/**
 * PayPal wire rounding. `formatPayPalAmount` uses Decimal#toFixed(2), which
 * applies Decimal.js ROUND_HALF_UP. This is the existing boundary, not a new
 * scheme. Commission and ledger net are never passed through this formatter.
 */
export const MONEY_PAYPAL_ROUNDING = "HALF_UP" as const;

/**
 * There is no in-app refund or PayPal capture-reversal. `PaymentStatus.REFUNDED`
 * exists on the enum; no application path writes it. Do not invent refund math.
 */
export const MONEY_REFUNDS_IMPLEMENTED = false;

export function zeroMoney(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

/** INV-ORDER-TOTAL-COMPOSITION: Decimal sum of price snapshots. */
export function sumMoney(amounts: readonly Prisma.Decimal[]): Prisma.Decimal {
  let total = zeroMoney();
  for (const amount of amounts) {
    total = total.plus(amount);
  }
  return total;
}

export function addMoney(left: Prisma.Decimal, right: Prisma.Decimal): Prisma.Decimal {
  return left.plus(right);
}

/** PayPal `amount.value` only. Never use this to round commission or net. */
export function formatPayPalAmount(amount: Prisma.Decimal): string {
  return amount.toFixed(MONEY_PRICE_SCALE);
}

export type OrderItemMoney = {
  sellerId: string;
  priceSnapshot: Prisma.Decimal;
};

/** Per-seller gross from item snapshots. Commission is applied later per seller. */
export function aggregateGrossBySeller(
  items: readonly OrderItemMoney[]
): Map<string, Prisma.Decimal> {
  const bySeller = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    const existing = bySeller.get(item.sellerId);
    bySeller.set(item.sellerId, existing ? existing.plus(item.priceSnapshot) : item.priceSnapshot);
  }
  return bySeller;
}
