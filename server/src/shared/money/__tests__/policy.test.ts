import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../../domain/invariants.js";
import {
  MONEY_COMMISSION_ROUNDING,
  MONEY_CURRENCY,
  MONEY_PAYPAL_ROUNDING,
  MONEY_PRICE_SCALE,
  MONEY_REFUNDS_IMPLEMENTED,
  addMoney,
  aggregateGrossBySeller,
  formatPayPalAmount,
  sumMoney,
  zeroMoney,
} from "../policy.js";
import {
  SELLER_LEDGER_CURRENCY,
  SELLER_LEDGER_PRICE_SCALE,
  computeSellerLedgerAmounts,
  ledgerNetMatchesGrossMinusCommission,
} from "../sellerLedger.js";

const d = (value: string) => new Prisma.Decimal(value);

describe("monetary policy", () => {
  it("centralizes BRL, 2-decimal price scale, and a single rounding scheme", () => {
    expect(MONEY_CURRENCY).toBe("BRL");
    expect(MONEY_PRICE_SCALE).toBe(2);
    expect(MONEY_COMMISSION_ROUNDING).toBe("exact");
    expect(MONEY_PAYPAL_ROUNDING).toBe("HALF_UP");
    expect(SELLER_LEDGER_CURRENCY).toBe(MONEY_CURRENCY);
    expect(SELLER_LEDGER_PRICE_SCALE).toBe(MONEY_PRICE_SCALE);
    expect(Prisma.Decimal.rounding).toBe(Prisma.Decimal.ROUND_HALF_UP);
  });

  it("does not implement refund math", () => {
    expect(MONEY_REFUNDS_IMPLEMENTED).toBe(false);
  });
});

describe(`${DomainInvariant.ORDER_TOTAL_COMPOSITION} sumMoney`, () => {
  it("sums empty input to Decimal zero", () => {
    expect(sumMoney([]).equals(zeroMoney())).toBe(true);
  });

  it("preserves the IEEE-754 0.1+0.2 identity", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([d("0.10"), d("0.20")]).equals(d("0.30"))).toBe(true);
  });

  it("sums multi-item snapshots including 99.99 + 0.01", () => {
    const total = sumMoney([d("99.99"), d("0.01"), d("10.00")]);
    expect(total.equals(d("110.00"))).toBe(true);
  });

  it("adds two Decimals without JavaScript number", () => {
    expect(addMoney(d("0.10"), d("0.20")).equals(d("0.30"))).toBe(true);
  });
});

describe("formatPayPalAmount", () => {
  it("formats listing/order scale as a 2-decimal string", () => {
    expect(formatPayPalAmount(d("150"))).toBe("150.00");
    expect(formatPayPalAmount(d("0.30"))).toBe("0.30");
    expect(formatPayPalAmount(d("0.1"))).toBe("0.10");
    expect(formatPayPalAmount(d("0.01"))).toBe("0.01");
  });

  it("uses Decimal HALF_UP only at the PayPal boundary", () => {
    expect(formatPayPalAmount(d("10.005"))).toBe("10.01");
    expect(formatPayPalAmount(d("10.004"))).toBe("10.00");
    const commission = computeSellerLedgerAmounts(d("1.00"), d("0.083")).commissionAmount;
    expect(commission.equals(d("0.083"))).toBe(true);
    expect(formatPayPalAmount(commission)).toBe("0.08");
    expect(commission.equals(d(formatPayPalAmount(commission)))).toBe(false);
  });
});

describe(`${DomainInvariant.SELLER_COMMISSION_DECIMAL} multi-item and multi-seller`, () => {
  it("aggregates gross per seller from mixed-item snapshots", () => {
    const bySeller = aggregateGrossBySeller([
      { sellerId: "seller-a", priceSnapshot: d("0.10") },
      { sellerId: "seller-b", priceSnapshot: d("50.00") },
      { sellerId: "seller-a", priceSnapshot: d("0.20") },
      { sellerId: "seller-b", priceSnapshot: d("0.01") },
    ]);

    expect(bySeller.size).toBe(2);
    expect(bySeller.get("seller-a")?.equals(d("0.30"))).toBe(true);
    expect(bySeller.get("seller-b")?.equals(d("50.01"))).toBe(true);
  });

  it("computes deterministic commission and net for two sellers and rates", () => {
    const bySeller = aggregateGrossBySeller([
      { sellerId: "seller-a", priceSnapshot: d("99.99") },
      { sellerId: "seller-a", priceSnapshot: d("0.01") },
      { sellerId: "seller-b", priceSnapshot: d("40.00") },
    ]);

    const sellerA = computeSellerLedgerAmounts(bySeller.get("seller-a")!, d("0.10"));
    const sellerB = computeSellerLedgerAmounts(bySeller.get("seller-b")!, d("0.08"));

    expect(sellerA.grossAmount.equals(d("100.00"))).toBe(true);
    expect(sellerA.commissionAmount.equals(d("10.000"))).toBe(true);
    expect(sellerA.netAmount.equals(d("90.000"))).toBe(true);
    expect(sellerB.grossAmount.equals(d("40.00"))).toBe(true);
    expect(sellerB.commissionAmount.equals(d("3.200"))).toBe(true);
    expect(sellerB.netAmount.equals(d("36.800"))).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(sellerA)).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(sellerB)).toBe(true);
  });

  it("keeps 1-cent and 0% / 100% commission edges exact", () => {
    const oneCent = computeSellerLedgerAmounts(d("0.01"), d("0.1"));
    expect(oneCent.commissionAmount.equals(d("0.001"))).toBe(true);
    expect(oneCent.netAmount.equals(d("0.009"))).toBe(true);

    const free = computeSellerLedgerAmounts(d("12.34"), d("0"));
    expect(free.commissionAmount.equals(d("0"))).toBe(true);
    expect(free.netAmount.equals(d("12.34"))).toBe(true);

    const takeAll = computeSellerLedgerAmounts(d("12.34"), d("1"));
    expect(takeAll.netAmount.equals(d("0.00"))).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(oneCent)).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(free)).toBe(true);
    expect(ledgerNetMatchesGrossMinusCommission(takeAll)).toBe(true);
  });
});
