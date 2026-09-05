import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../../domain/invariants.js";
import {
  SELLER_LEDGER_CURRENCY,
  SELLER_LEDGER_PRICE_SCALE,
  computeSellerLedgerAmounts,
  ledgerNetMatchesGrossMinusCommission,
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
});
