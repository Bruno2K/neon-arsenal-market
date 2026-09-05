import { Prisma } from "@prisma/client";

/**
 * Payout currency for SellerTransaction amounts. PayPal OrdersCreate uses BRL.
 * `Listing.currency` is catalog metadata (default USD) and is not the ledger currency.
 */
export const SELLER_LEDGER_CURRENCY = "BRL" as const;

/**
 * Marketplace listing prices and PayPal capture amounts use 2 decimal places
 * (`toFixed(2)` at the PayPal boundary). Commission is `gross × rate` with
 * Prisma Decimal (exact Decimal.js). That product may have extra fractional
 * digits; there is no second rounding step and no JavaScript `number` math.
 */
export const SELLER_LEDGER_PRICE_SCALE = 2;

export type SellerLedgerAmounts = {
  grossAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
};

/**
 * INV-SELLER-COMMISSION-DECIMAL / INV-SELLER-LEDGER-SOURCE
 *
 * `commission = gross × seller.commissionRate`
 * `net = gross − commission`
 *
 * Settled rows are written with `PaymentStatus.PAID`. `REFUNDED` exists on the
 * enum but has no application path.
 */
export function computeSellerLedgerAmounts(
  grossAmount: Prisma.Decimal,
  commissionRate: Prisma.Decimal
): SellerLedgerAmounts {
  const commissionAmount = grossAmount.mul(commissionRate);
  const netAmount = grossAmount.minus(commissionAmount);
  return { grossAmount, commissionAmount, netAmount };
}

export function ledgerNetMatchesGrossMinusCommission(amounts: SellerLedgerAmounts): boolean {
  return amounts.netAmount.equals(amounts.grossAmount.minus(amounts.commissionAmount));
}
