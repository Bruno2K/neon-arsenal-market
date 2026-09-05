import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { prisma } from "../shared/database/index.js";
import { commissionsService } from "../modules/commissions/commissions.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { seedDemoData } from "../scripts/seedDemoData.js";
import { DEMO_USERS } from "../scripts/demoCatalog.js";
import { createCheckoutGraph, createOrder, orderKey } from "./helpers/index.js";

describe(`${DomainInvariant.SELLER_LEDGER_SOURCE} demo seed and GET balance`, () => {
  it("seeds seller balances that match PAID ledger SUM(netAmount)", async () => {
    await seedDemoData();

    const sellers = await prisma.seller.findMany({
      include: { user: { select: { email: true } } },
    });
    expect(sellers.length).toBe(DEMO_USERS.filter((user) => user.seller).length);

    for (const seller of sellers) {
      const paid = await prisma.sellerTransaction.aggregate({
        where: { sellerId: seller.id, status: "PAID" },
        _sum: { netAmount: true },
      });
      const ledgerSum = paid._sum.netAmount ?? new Prisma.Decimal(0);
      expect(seller.balance.equals(ledgerSum)).toBe(true);
      expect(seller.balance.isZero()).toBe(true);
    }

    const ledgerRows = await prisma.sellerTransaction.count();
    expect(ledgerRows).toBe(0);
  });

  it("GET balance JSON is a Decimal string equal to the PAID ledger net", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("balance-json-ledger")
    );

    await paymentsService.confirmPayment(created.id);

    const result = await commissionsService.getBalance(fixture.sellerUser.id);
    const json = JSON.parse(JSON.stringify(result)) as { balance: unknown };
    const txn = await prisma.sellerTransaction.findFirst({
      where: { sellerId: fixture.seller.id, status: "PAID" },
    });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(typeof json.balance).toBe("string");
    expect(typeof result.balance).not.toBe("number");
    expect(result.balance.equals(new Prisma.Decimal("90"))).toBe(true);
    expect(new Prisma.Decimal(json.balance as string).equals(seller!.balance)).toBe(true);
    expect(new Prisma.Decimal(json.balance as string).equals(txn!.netAmount)).toBe(true);
  });
});
