import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { prisma } from "../shared/database/index.js";
import { commissionsService } from "../modules/commissions/commissions.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { seedDemoData } from "../scripts/seedDemoData.js";
import { DEMO_USERS } from "../scripts/demoCatalog.js";
import { createCheckoutGraph, createListing, createOrder, orderKey } from "./helpers/index.js";

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

  it("re-seed zeros stale catalog balances when the PAID ledger is empty", async () => {
    await seedDemoData();

    const staleByEmail: Record<string, string> = {
      "seller@skinmarket.gg": "1250.75",
      "pro_trader@skinmarket.gg": "580.00",
      "rustking@skinmarket.gg": "210.40",
    };

    for (const [email, stale] of Object.entries(staleByEmail)) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      await prisma.seller.update({
        where: { userId: user.id },
        data: { balance: new Prisma.Decimal(stale) },
      });
    }

    await seedDemoData();

    for (const email of Object.keys(staleByEmail)) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const seller = await prisma.seller.findUniqueOrThrow({ where: { userId: user.id } });
      const paid = await prisma.sellerTransaction.count({
        where: { sellerId: seller.id, status: "PAID" },
      });
      expect(paid).toBe(0);
      expect(seller.balance.equals(new Prisma.Decimal("0.00"))).toBe(true);
    }
  });

  it("re-seed does not wipe PAID ledger net already credited by confirm", async () => {
    await seedDemoData();

    const sellerUser = await prisma.user.findUniqueOrThrow({
      where: { email: "seller@skinmarket.gg" },
    });
    const seller = await prisma.seller.findUniqueOrThrow({ where: { userId: sellerUser.id } });
    const buyer = await prisma.user.findUniqueOrThrow({ where: { email: "buyer@skinmarket.gg" } });
    const product = await prisma.product.findFirstOrThrow();
    const listing = await createListing({
      productId: product.id,
      sellerId: seller.id,
      price: "100.00",
    });
    const created = await createOrder(buyer.id, [listing.id], orderKey("seed-paid-ledger"));
    await paymentsService.confirmPayment(created.id);

    const credited = await prisma.sellerTransaction.aggregate({
      where: { sellerId: seller.id, status: "PAID" },
      _sum: { netAmount: true },
    });
    expect(credited._sum.netAmount?.equals(new Prisma.Decimal("90"))).toBe(true);

    await prisma.seller.update({
      where: { id: seller.id },
      data: { balance: new Prisma.Decimal("1250.75") },
    });

    await seedDemoData();

    const after = await prisma.seller.findUniqueOrThrow({ where: { id: seller.id } });
    const orders = await prisma.order.count({ where: { id: created.id } });
    const txns = await prisma.sellerTransaction.count({
      where: { sellerId: seller.id, status: "PAID" },
    });

    expect(after.balance.equals(credited._sum.netAmount!)).toBe(true);
    expect(after.balance.equals(new Prisma.Decimal("0.00"))).toBe(false);
    expect(after.balance.equals(new Prisma.Decimal("1250.75"))).toBe(false);
    expect(orders).toBe(1);
    expect(txns).toBe(1);
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
