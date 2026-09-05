import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { prisma } from "../shared/database/index.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import {
  createCheckoutGraph,
  createListing,
  createOrder,
  createSeller,
  orderKey,
} from "./helpers/index.js";

describe(`${DomainInvariant.SELLER_LEDGER_SOURCE} seller ledger (postgres)`, () => {
  it("does not duplicate ledger rows or balance on sequential confirmPayment", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("ledger-dup-confirm")
    );

    await paymentsService.confirmPayment(created.id);
    await paymentsService.confirmPayment(created.id);
    await paymentsService.confirmPayment(created.id);

    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(txns).toHaveLength(1);
    expect(txns[0]?.status).toBe("PAID");
    expect(seller?.balance.equals(new Prisma.Decimal("90"))).toBe(true);
    expect(txns[0]?.netAmount.equals(seller!.balance)).toBe(true);
  });

  it("commits a single ledger row under concurrent confirmPayment", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("ledger-concurrent-confirm")
    );

    const results = await Promise.allSettled([
      paymentsService.confirmPayment(created.id),
      paymentsService.confirmPayment(created.id),
      paymentsService.confirmPayment(created.id),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    expect(txns).toHaveLength(1);
    expect(seller?.balance.equals(new Prisma.Decimal("90"))).toBe(true);
  });

  it("persists net = gross − commission on the committed ledger row", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("ledger-net-identity")
    );

    await paymentsService.confirmPayment(created.id);

    const txn = await prisma.sellerTransaction.findFirst({ where: { orderId: created.id } });
    expect(txn).not.toBeNull();
    expect(txn!.grossAmount.equals(new Prisma.Decimal("100.00"))).toBe(true);
    expect(txn!.commissionAmount.equals(new Prisma.Decimal("10.00"))).toBe(true);
    expect(txn!.netAmount.equals(txn!.grossAmount.minus(txn!.commissionAmount))).toBe(true);
    expect(txn!.status).toBe("PAID");
  });

  it("sums 0.10 + 0.20 as Decimal 0.30 so IEEE-754 cannot drift the ledger", async () => {
    const fixture = await createCheckoutGraph(0);
    const listingA = await createListing({
      productId: fixture.product.id,
      sellerId: fixture.seller.id,
      price: "0.10",
    });
    const listingB = await createListing({
      productId: fixture.product.id,
      sellerId: fixture.seller.id,
      price: "0.20",
    });
    const created = await createOrder(
      fixture.customer.id,
      [listingA.id, listingB.id],
      orderKey("ledger-ieee")
    );

    await paymentsService.confirmPayment(created.id);

    expect(0.1 + 0.2).not.toBe(0.3);
    const txn = await prisma.sellerTransaction.findFirst({ where: { orderId: created.id } });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    expect(txn?.grossAmount.equals(new Prisma.Decimal("0.30"))).toBe(true);
    expect(txn?.commissionAmount.equals(new Prisma.Decimal("0.030"))).toBe(true);
    expect(txn?.netAmount.equals(new Prisma.Decimal("0.270"))).toBe(true);
    expect(seller?.balance.equals(new Prisma.Decimal("0.270"))).toBe(true);
  });

  it("writes one PAID row per seller in a multi-seller order", async () => {
    const fixture = await createCheckoutGraph();
    const seller2 = await createSeller();
    const listing2 = await createListing({
      productId: fixture.product.id,
      sellerId: seller2.id,
      price: "50.00",
    });
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id, listing2.id],
      orderKey("ledger-two-sellers")
    );

    await paymentsService.confirmPayment(created.id);

    const txns = await prisma.sellerTransaction.findMany({
      where: { orderId: created.id },
      orderBy: { grossAmount: "desc" },
    });
    expect(txns).toHaveLength(2);
    expect(txns.map((row) => row.sellerId).sort()).toEqual([fixture.seller.id, seller2.id].sort());
    expect(txns.every((row) => row.status === "PAID")).toBe(true);

    const seller1 = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    const sellerTwo = await prisma.seller.findUnique({ where: { id: seller2.id } });
    expect(seller1?.balance.equals(new Prisma.Decimal("90"))).toBe(true);
    expect(sellerTwo?.balance.equals(new Prisma.Decimal("45"))).toBe(true);
  });
});
