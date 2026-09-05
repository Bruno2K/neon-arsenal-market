import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { projectedDemoSellerBalance } from "../seedDemoData.js";

describe("projectedDemoSellerBalance", () => {
  it("uses catalog zero when the seller has no PAID ledger rows", () => {
    const balance = projectedDemoSellerBalance("0.00", null);

    expect(balance).toBeInstanceOf(Prisma.Decimal);
    expect(balance.equals(new Prisma.Decimal("0.00"))).toBe(true);
    expect(typeof balance).not.toBe("number");
  });

  it("keeps SUM(PAID netAmount) so re-seed does not wipe credited net", () => {
    const credited = new Prisma.Decimal("90.00");
    const balance = projectedDemoSellerBalance("0.00", credited);

    expect(balance.equals(credited)).toBe(true);
    expect(balance.isZero()).toBe(false);
  });
});
