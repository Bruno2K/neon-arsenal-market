import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../../domain/invariants.js";
import {
  SELLER_LEDGER_CURRENCY,
  SELLER_LEDGER_PRICE_SCALE,
  computeSellerLedgerAmounts,
  computeSellerLedgerCompensation,
  findSellerProjectionDrifts,
  ledgerNetMatchesGrossMinusCommission,
  paidLedgerSumOrZero,
  sellerProjectionMatchesLedger,
} from "../sellerLedger.js";

describe(`${DomainInvariant.SELLER_COMMISSION_DECIMAL} seller ledger amounts`, () => {
  it("uses BRL and 2-decimal listing/PayPal scale without a third rounding scheme", () => {
    expect(SELLER_LEDGER_CURRENCY).toBe("BRL");
    expect(SELLER_LEDGER_PRICE_SCALE).toBe(2);
  });

  it("computes net = gross − commission with Decimal, not JavaScript number", () => {
    const amounts = computeSellerLedgerAmounts(new Prisma.Decimal("150.00"), new Prisma.Decimal("0.1"));

    expect(amounts.grossAmount.equals(new Prisma.Decimal("150.00"))).toBe(true);
    expect(amounts.commissionAmount.equals(new Prisma.Decimal("15.000"))).toBe(true);
    expect(amounts.netAmount.equals(new Prisma.Decimal("135.000"))).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(amounts)).toBe(true);
  });

  it("preserves the IEEE-754 0.1+0.2 identity that number arithmetic breaks", () => {
    const gross = new Prisma.Decimal("0.10").plus(new Prisma.Decimal("0.20"));
    const amounts = computeSellerLedgerAmounts(gross, new Prisma.Decimal("0.1"));

    expect(0.1 + 0.2).not.toBe(0.3);
    expect(gross.equals(new Prisma.Decimal("0.30"))).toBe(true);
    expect(amounts.commissionAmount.equals(new Prisma.Decimal("0.030"))).toBe(true);
    expect(amounts.netAmount.equals(new Prisma.Decimal("0.270"))).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(amounts)).toBe(true);
  });

  it("keeps extra fractional digits from rate × gross instead of rounding independently", () => {
    const amounts = computeSellerLedgerAmounts(new Prisma.Decimal("1.00"), new Prisma.Decimal("0.083"));

    expect(amounts.commissionAmount.equals(new Prisma.Decimal("0.083"))).toBe(true);
    expect(amounts.netAmount.equals(new Prisma.Decimal("0.917"))).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(amounts)).toBe(true);
  });

  it("allows a 100% commission to settle at net zero", () => {
    const amounts = computeSellerLedgerAmounts(new Prisma.Decimal("40.00"), new Prisma.Decimal("1"));

    expect(amounts.netAmount.equals(new Prisma.Decimal("0.00"))).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(amounts)).toBe(true);
  });

  it("creates an exact Decimal inverse for refund compensation", () => {
    const credit = computeSellerLedgerAmounts(
      new Prisma.Decimal("1.00"),
      new Prisma.Decimal("0.083")
    );
    const compensation = computeSellerLedgerCompensation(credit);

    expect(compensation.grossAmount.equals(new Prisma.Decimal("-1.00"))).toBe(true);
    expect(compensation.commissionAmount.equals(new Prisma.Decimal("-0.083"))).toBe(true);
    expect(compensation.netAmount.equals(new Prisma.Decimal("-0.917"))).toBe(true);
    expect(credit.netAmount.plus(compensation.netAmount).isZero()).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(compensation)).toBe(true);
  });
});

describe(`${DomainInvariant.SELLER_LEDGER_SOURCE} projection vs PAID SUM`, () => {
  it("treats a missing SUM as Decimal zero", () => {
    expect(paidLedgerSumOrZero(null).equals(new Prisma.Decimal(0))).toBe(true);
    expect(paidLedgerSumOrZero(undefined).equals(new Prisma.Decimal(0))).toBe(true);
    expect(paidLedgerSumOrZero(new Prisma.Decimal("90.00")).equals(new Prisma.Decimal("90.00"))).toBe(
      true
    );
  });

  it("matches projection to ledger with Decimal.equals, not JavaScript number", () => {
    const projected = new Prisma.Decimal("0.10").plus(new Prisma.Decimal("0.20"));
    expect(sellerProjectionMatchesLedger(projected, new Prisma.Decimal("0.30"))).toBe(true);
    expect(sellerProjectionMatchesLedger(projected, new Prisma.Decimal("0.300"))).toBe(true);
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("finds no drifts when every projection equals PAID SUM", () => {
    const drifts = findSellerProjectionDrifts(
      [
        { id: "seller-a", balance: new Prisma.Decimal("90.00") },
        { id: "seller-b", balance: new Prisma.Decimal(0) },
      ],
      [
        { sellerId: "seller-a", netAmount: new Prisma.Decimal("90.00") },
      ]
    );
    expect(drifts).toEqual([]);
  });

  it("flags a stale projection and an empty-ledger seller with leftover balance", () => {
    const drifts = findSellerProjectionDrifts(
      [
        { id: "seller-a", balance: new Prisma.Decimal("80.00") },
        { id: "seller-b", balance: new Prisma.Decimal("1250.75") },
      ],
      [{ sellerId: "seller-a", netAmount: new Prisma.Decimal("90.00") }]
    );

    expect(drifts).toHaveLength(2);
    expect(drifts[0]?.sellerId).toBe("seller-a");
    expect(drifts[0]?.projected.equals(new Prisma.Decimal("80.00"))).toBe(true);
    expect(drifts[0]?.ledgerSum.equals(new Prisma.Decimal("90.00"))).toBe(true);
    expect(drifts[1]?.sellerId).toBe("seller-b");
    expect(drifts[1]?.ledgerSum.equals(new Prisma.Decimal(0))).toBe(true);
  });
});
