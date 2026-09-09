import { Prisma } from "@prisma/client";
import { MONEY_CURRENCY, MONEY_PRICE_SCALE } from "./policy.js";

/**
 * Ledger aliases for the canonical policy in `policy.ts`.
 * Do not define a second currency, scale, or rounding mode here.
 */
export const SELLER_LEDGER_CURRENCY = MONEY_CURRENCY;
export const SELLER_LEDGER_PRICE_SCALE = MONEY_PRICE_SCALE;

export type SellerLedgerAmounts = {
  grossAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
};

export type SellerLedgerCompensationAmounts = SellerLedgerAmounts;

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

/**
 * Produce the exact signed inverse of an applied credit. Decimal.negated()
 * preserves the original scale/precision and avoids JavaScript number math.
 */
export function computeSellerLedgerCompensation(
  credit: SellerLedgerAmounts
): SellerLedgerCompensationAmounts {
  return {
    grossAmount: credit.grossAmount.negated(),
    commissionAmount: credit.commissionAmount.negated(),
    netAmount: credit.netAmount.negated(),
  };
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
