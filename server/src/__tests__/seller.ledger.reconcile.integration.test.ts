import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { prisma } from "../shared/database/index.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { commissionsService } from "../modules/commissions/commissions.service.js";
import { AuditAction, AuditResourceType } from "../modules/audit/audit.types.js";
import {
  createCheckoutGraph,
  createListing,
  createOrder,
  createSeller,
  orderKey,
} from "./helpers/index.js";

async function paidLedgerSum(sellerId: string) {
  const paid = await prisma.sellerTransaction.aggregate({
    where: { sellerId, status: "PAID" },
    _sum: { netAmount: true },
  });
  return paid._sum.netAmount ?? new Prisma.Decimal(0);
}

describe(`${DomainInvariant.SELLER_LEDGER_SOURCE} seller ledger reconcile (postgres)`, () => {
  it("does not write when the projection already matches PAID SUM", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("reconcile-match")
    );
    await paymentsService.confirmPayment(created.id);

    const beforeSeller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    const beforeAudit = await prisma.auditLog.count({
      where: {
        action: AuditAction.SELLER_BALANCE_RECONCILED,
        resourceId: fixture.seller.id,
      },
    });
    const beforeTxns = await prisma.sellerTransaction.count({
      where: { sellerId: fixture.seller.id },
    });

    const result = await commissionsService.reconcileSellerLedger();

    expect(result.corrected).toBe(0);
    const afterSeller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    const afterAudit = await prisma.auditLog.count({
      where: {
        action: AuditAction.SELLER_BALANCE_RECONCILED,
        resourceId: fixture.seller.id,
      },
    });
    const afterTxns = await prisma.sellerTransaction.count({
      where: { sellerId: fixture.seller.id },
    });

    expect(afterSeller?.balance.equals(beforeSeller!.balance)).toBe(true);
    expect(afterSeller?.balance.equals(await paidLedgerSum(fixture.seller.id))).toBe(true);
    expect(afterAudit).toBe(beforeAudit);
    expect(afterTxns).toBe(beforeTxns);
  });

  it("corrects a drifted projection once, audits, and is a no-op on the second run", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("reconcile-drift")
    );
    await paymentsService.confirmPayment(created.id);

    await prisma.seller.update({
      where: { id: fixture.seller.id },
      data: { balance: new Prisma.Decimal("0.00") },
    });

    const ledgerSum = await paidLedgerSum(fixture.seller.id);
    expect(ledgerSum.equals(new Prisma.Decimal("90"))).toBe(true);

    const first = await commissionsService.reconcileSellerLedger();
    expect(first.corrected).toBe(1);

    const corrected = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    expect(corrected?.balance.equals(ledgerSum)).toBe(true);

    const audits = await prisma.auditLog.findMany({
      where: {
        action: AuditAction.SELLER_BALANCE_RECONCILED,
        resourceType: AuditResourceType.Seller,
        resourceId: fixture.seller.id,
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorId).toBeNull();
    expect(audits[0]?.actorRole).toBeNull();
    const before = audits[0]?.before as { balance: string };
    const after = audits[0]?.after as { balance: string };
    expect(new Prisma.Decimal(before.balance).equals(new Prisma.Decimal("0"))).toBe(true);
    expect(new Prisma.Decimal(after.balance).equals(ledgerSum)).toBe(true);

    const txnCount = await prisma.sellerTransaction.count({
      where: { sellerId: fixture.seller.id },
    });
    expect(txnCount).toBe(1);

    const second = await commissionsService.reconcileSellerLedger();
    expect(second.corrected).toBe(0);
    const still = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    expect(still?.balance.equals(ledgerSum)).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: {
          action: AuditAction.SELLER_BALANCE_RECONCILED,
          resourceId: fixture.seller.id,
        },
      })
    ).toBe(1);
  });

  it("zeros a stale catalog projection when the PAID ledger is empty", async () => {
    const seller = await createSeller();
    await prisma.seller.update({
      where: { id: seller.id },
      data: { balance: new Prisma.Decimal("1250.75") },
    });

    const result = await commissionsService.reconcileSellerLedger();
    expect(result.corrected).toBeGreaterThanOrEqual(1);

    const aligned = await prisma.seller.findUnique({ where: { id: seller.id } });
    expect(aligned?.balance.equals(new Prisma.Decimal(0))).toBe(true);
    expect(await prisma.sellerTransaction.count({ where: { sellerId: seller.id } })).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: AuditAction.SELLER_BALANCE_RECONCILED,
        resourceId: seller.id,
      },
    });
    expect(
      new Prisma.Decimal((audit?.before as { balance: string }).balance).equals(
        new Prisma.Decimal("1250.75")
      )
    ).toBe(true);
    expect(
      new Prisma.Decimal((audit?.after as { balance: string }).balance).equals(new Prisma.Decimal(0))
    ).toBe(true);
  });

  it("does not double-credit when reconcile races confirmPayment", async () => {
    const fixture = await createCheckoutGraph();
    const listing2 = await createListing({
      productId: fixture.product.id,
      sellerId: fixture.seller.id,
      price: "100.00",
    });
    const first = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("reconcile-race-1")
    );
    await paymentsService.confirmPayment(first.id);

    await prisma.seller.update({
      where: { id: fixture.seller.id },
      data: { balance: new Prisma.Decimal("50.00") },
    });

    const second = await createOrder(
      fixture.customer.id,
      [listing2.id],
      orderKey("reconcile-race-2")
    );

    const results = await Promise.allSettled([
      paymentsService.confirmPayment(second.id),
      commissionsService.reconcileSellerLedger(),
      commissionsService.reconcileSellerLedger(),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const txns = await prisma.sellerTransaction.findMany({
      where: { sellerId: fixture.seller.id, status: "PAID" },
    });
    expect(txns).toHaveLength(2);
    const ledgerSum = txns.reduce(
      (sum, row) => sum.plus(row.netAmount),
      new Prisma.Decimal(0)
    );
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    expect(seller?.balance.equals(ledgerSum)).toBe(true);
    expect(seller?.balance.equals(new Prisma.Decimal("180.00"))).toBe(true);
  });
});
