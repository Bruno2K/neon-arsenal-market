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

/** PAID `SUM(netAmount)` is empty → projection must be Decimal zero, not null. */
export function paidLedgerSumOrZero(sum: Prisma.Decimal | null | undefined): Prisma.Decimal {
  return sum ?? new Prisma.Decimal(0);
}

export function sellerProjectionMatchesLedger(
  projected: Prisma.Decimal,
  ledgerSum: Prisma.Decimal
): boolean {
  return projected.equals(ledgerSum);
}

export type SellerProjectionRow = {
  id: string;
  balance: Prisma.Decimal;
};

export type PaidLedgerSumRow = {
  sellerId: string;
  netAmount: Prisma.Decimal | null;
};

export type SellerProjectionDrift = {
  sellerId: string;
  projected: Prisma.Decimal;
  ledgerSum: Prisma.Decimal;
};

/**
 * Unlocked candidate scan. Callers must re-read `Seller.balance` and PAID SUM
 * under `SELECT … FOR UPDATE` before correcting (issue #45).
 */
export function findSellerProjectionDrifts(
  projections: SellerProjectionRow[],
  paidSums: PaidLedgerSumRow[]
): SellerProjectionDrift[] {
  const ledgerBySeller = new Map<string, Prisma.Decimal>();
  for (const row of paidSums) {
    ledgerBySeller.set(row.sellerId, paidLedgerSumOrZero(row.netAmount));
  }

  const drifts: SellerProjectionDrift[] = [];
  for (const seller of projections) {
    const ledgerSum = ledgerBySeller.get(seller.id) ?? new Prisma.Decimal(0);
    if (!sellerProjectionMatchesLedger(seller.balance, ledgerSum)) {
      drifts.push({ sellerId: seller.id, projected: seller.balance, ledgerSum });
    }
  }
  return drifts;
}
