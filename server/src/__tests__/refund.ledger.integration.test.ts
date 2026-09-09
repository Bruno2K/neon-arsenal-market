import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import {
  appendCompletedRefundCompensation,
  refundsService,
} from "../modules/payments/refunds.service.js";
import { commissionsService } from "../modules/commissions/commissions.service.js";
import {
  createCheckoutGraph,
  createListing,
  createOrder,
  createSeller,
  orderKey,
} from "./helpers/index.js";

async function createObligation(orderId: string, captureId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  return refundsService.createObligation({
    orderId,
    providerCaptureId: captureId,
    amount: order.totalAmount,
  });
}

async function completeRefund(refundId: string, providerRefundId: string) {
  return refundsService.recordProviderConfirmedCompletion({ refundId, providerRefundId });
}

describe("TASK-0013 durable refund and append-only seller ledger (postgres)", () => {
  it("applies the forward migration without changing a historical PAID row economically", async () => {
    const schema = `migration_${randomUUID().replaceAll("-", "")}`;
    const migrationSql = readFileSync(
      new URL(
        "../../prisma/migrations/20260909010000_refund_append_only_ledger/migration.sql",
        import.meta.url
      ),
      "utf8"
    );
    const statements = migrationSql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(`CREATE TYPE "PaymentProvider" AS ENUM ('PAYPAL')`);
      await tx.$executeRawUnsafe(`CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED')`);
      await tx.$executeRawUnsafe(`CREATE TABLE "Order" ("id" TEXT PRIMARY KEY)`);
      await tx.$executeRawUnsafe(`
        CREATE TABLE "SellerTransaction" (
          "id" TEXT PRIMARY KEY,
          "sellerId" TEXT NOT NULL,
          "orderId" TEXT NOT NULL,
          "grossAmount" DECIMAL(65,30) NOT NULL,
          "commissionAmount" DECIMAL(65,30) NOT NULL,
          "netAmount" DECIMAL(65,30) NOT NULL,
          "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SellerTransaction_net_identity_chk"
            CHECK ("netAmount" = "grossAmount" - "commissionAmount"),
          CONSTRAINT "SellerTransaction_amounts_non_negative_chk"
            CHECK ("grossAmount" >= 0 AND "commissionAmount" >= 0 AND "netAmount" >= 0)
        )
      `);
      await tx.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "SellerTransaction_sellerId_orderId_key"
          ON "SellerTransaction"("sellerId", "orderId")
      `);
      await tx.$executeRawUnsafe(`INSERT INTO "Order" ("id") VALUES ('order-legacy')`);
      await tx.$executeRawUnsafe(`
        INSERT INTO "SellerTransaction"
          ("id", "sellerId", "orderId", "grossAmount", "commissionAmount", "netAmount", "status", "createdAt")
        VALUES
          ('txn-legacy', 'seller-legacy', 'order-legacy', 100.00, 10.000, 90.000, 'PAID', '2026-09-08T12:34:56.789Z')
      `);

      type LegacyRow = {
        id: string;
        sellerId: string;
        orderId: string;
        grossAmount: Prisma.Decimal;
        commissionAmount: Prisma.Decimal;
        netAmount: Prisma.Decimal;
        status: string;
        createdAt: Date;
      };
      const before = (
        await tx.$queryRawUnsafe<LegacyRow[]>(`
          SELECT "id", "sellerId", "orderId", "grossAmount", "commissionAmount",
                 "netAmount", "status"::TEXT AS "status", "createdAt"
          FROM "SellerTransaction"
        `)
      )[0]!;

      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement);
      }

      const afterEconomic = (
        await tx.$queryRawUnsafe<LegacyRow[]>(`
          SELECT "id", "sellerId", "orderId", "grossAmount", "commissionAmount",
                 "netAmount", "status"::TEXT AS "status", "createdAt"
          FROM "SellerTransaction"
        `)
      )[0]!;
      const afterIdentity = (
        await tx.$queryRawUnsafe<{
          refundId: string | null;
          entryType: string;
          economicEventId: string;
        }[]>(`
          SELECT "refundId", "entryType"::TEXT AS "entryType", "economicEventId"
          FROM "SellerTransaction"
        `)
      )[0]!;

      expect(afterEconomic.id).toBe(before.id);
      expect(afterEconomic.sellerId).toBe(before.sellerId);
      expect(afterEconomic.orderId).toBe(before.orderId);
      expect(afterEconomic.grossAmount.equals(before.grossAmount)).toBe(true);
      expect(afterEconomic.commissionAmount.equals(before.commissionAmount)).toBe(true);
      expect(afterEconomic.netAmount.equals(before.netAmount)).toBe(true);
      expect(afterEconomic.status).toBe(before.status);
      expect(afterEconomic.createdAt).toEqual(before.createdAt);
      expect(afterIdentity.entryType).toBe("PAYMENT_CREDIT");
      expect(afterIdentity.economicEventId).toBe(before.orderId);
      expect(afterIdentity.refundId).toBeNull();

      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  });

  it("preserves the exact economic value of an existing PAID credit representation", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("migrated-credit")
    );
    await paymentsService.confirmPayment(order.id);

    const credit = await prisma.sellerTransaction.findUniqueOrThrow({
      where: {
        sellerId_entryType_economicEventId: {
          sellerId: fixture.seller.id,
          entryType: "PAYMENT_CREDIT",
          economicEventId: order.id,
        },
      },
    });
    const seller = await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } });

    expect(credit.status).toBe("PAID");
    expect(credit.refundId).toBeNull();
    expect(credit.grossAmount.equals(new Prisma.Decimal("100.00"))).toBe(true);
    expect(credit.commissionAmount.equals(new Prisma.Decimal("10.00"))).toBe(true);
    expect(credit.netAmount.equals(new Prisma.Decimal("90.00"))).toBe(true);
    expect(seller.balance.equals(credit.netAmount)).toBe(true);
  });

  it.each(["PENDING", "PROCESSING", "FAILED"] as const)(
    "does not compensate a seller while the refund is %s",
    async (status) => {
      const fixture = await createCheckoutGraph();
      const order = await createOrder(
        fixture.customer.id,
        [fixture.listings[0].id],
        orderKey(`pre-completion-${status}`)
      );
      await paymentsService.confirmPayment(order.id);
      const refund = await createObligation(order.id, `CAPTURE-pre-completion-${status}`);
      await prisma.refund.update({
        where: { id: refund.id },
        data: { status, failureReason: status === "FAILED" ? "test_failure" : null },
      });

      const applied = await prisma.$transaction((tx) =>
        appendCompletedRefundCompensation(tx, refund.id)
      );

      expect(applied).toBe(0);
      expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(0);
      const seller = await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } });
      expect(seller.balance.equals(new Prisma.Decimal("90.00"))).toBe(true);
    }
  );

  it("appends a distinct exact compensation and updates balance in the same operation", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("append-compensation")
    );
    await paymentsService.confirmPayment(order.id);
    const refund = await createObligation(order.id, "CAPTURE-append-compensation");

    const completion = await completeRefund(refund.id, "REFUND-append-compensation");
    expect(completion.compensatedSellers).toBe(1);
    expect(completion.refund.status).toBe("COMPLETED");
    expect(completion.refund.providerRefundId).toBe("REFUND-append-compensation");

    const ledger = await prisma.sellerTransaction.findMany({
      where: { sellerId: fixture.seller.id, orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(ledger).toHaveLength(2);
    const credit = ledger.find((row) => row.entryType === "PAYMENT_CREDIT")!;
    const compensation = ledger.find((row) => row.entryType === "REFUND_COMPENSATION")!;
    expect(compensation.refundId).toBe(refund.id);
    expect(compensation.economicEventId).toBe(refund.id);
    expect(credit.grossAmount.plus(compensation.grossAmount).isZero()).toBe(true);
    expect(credit.commissionAmount.plus(compensation.commissionAmount).isZero()).toBe(true);
    expect(credit.netAmount.plus(compensation.netAmount).isZero()).toBe(true);

    const seller = await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } });
    expect(seller.balance.isZero()).toBe(true);
  });

  it("makes duplicate and concurrent compensation attempts unable to double-debit", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("duplicate-compensation")
    );
    await paymentsService.confirmPayment(order.id);
    const refund = await createObligation(order.id, "CAPTURE-duplicate-compensation");

    const results = await Promise.all([
      completeRefund(refund.id, "REFUND-duplicate-compensation"),
      completeRefund(refund.id, "REFUND-duplicate-compensation"),
      completeRefund(refund.id, "REFUND-duplicate-compensation"),
    ]);
    expect(results.reduce((sum, result) => sum + result.compensatedSellers, 0)).toBe(1);
    expect(
      await prisma.sellerTransaction.count({
        where: { refundId: refund.id, entryType: "REFUND_COMPENSATION" },
      })
    ).toBe(1);
    expect(
      (await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } })).balance.isZero()
    ).toBe(true);
  });

  it("creates one durable obligation per provider capture and rejects a conflicting claim", async () => {
    const fixture = await createCheckoutGraph(2);
    const firstOrder = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("refund-obligation-a")
    );
    const first = await createObligation(firstOrder.id, "CAPTURE-one-economic-refund");
    const replay = await createObligation(firstOrder.id, "CAPTURE-one-economic-refund");
    expect(replay.id).toBe(first.id);

    const secondOrder = await createOrder(
      fixture.customer.id,
      [fixture.listings[1].id],
      orderKey("refund-obligation-b")
    );
    await expect(createObligation(secondOrder.id, "CAPTURE-one-economic-refund")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await prisma.refund.count()).toBe(1);
  });

  it("does not create a seller debit when the order has no original credit", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("no-credit")
    );
    const refund = await createObligation(order.id, "CAPTURE-no-credit");

    const completion = await completeRefund(refund.id, "REFUND-no-credit");
    expect(completion.compensatedSellers).toBe(0);
    expect(completion.refund.status).toBe("COMPLETED");
    expect(await prisma.sellerTransaction.count({ where: { orderId: order.id } })).toBe(0);
    const seller = await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } });
    expect(seller.balance.isZero()).toBe(true);
  });

  it("compensates every credited seller in one order exactly once", async () => {
    const fixture = await createCheckoutGraph();
    const secondSeller = await createSeller();
    const secondListing = await createListing({
      productId: fixture.product.id,
      sellerId: secondSeller.id,
      price: "50.00",
    });
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id, secondListing.id],
      orderKey("multi-seller-compensation")
    );
    await paymentsService.confirmPayment(order.id);
    const refund = await createObligation(order.id, "CAPTURE-multi-seller");

    expect((await completeRefund(refund.id, "REFUND-multi-seller")).compensatedSellers).toBe(2);
    expect((await completeRefund(refund.id, "REFUND-multi-seller")).compensatedSellers).toBe(0);
    const reversals = await prisma.sellerTransaction.findMany({
      where: { refundId: refund.id, entryType: "REFUND_COMPENSATION" },
    });
    expect(reversals).toHaveLength(2);
    const sellers = await prisma.seller.findMany({
      where: { id: { in: [fixture.seller.id, secondSeller.id] } },
    });
    expect(sellers.every((seller) => seller.balance.isZero())).toBe(true);
  });

  it("keeps ledger reconciliation idempotent after Decimal BRL compensation", async () => {
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
    const order = await createOrder(
      fixture.customer.id,
      [listingA.id, listingB.id],
      orderKey("refund-decimal-reconcile")
    );
    await paymentsService.confirmPayment(order.id);
    const refund = await createObligation(order.id, "CAPTURE-decimal-reconcile");
    await completeRefund(refund.id, "REFUND-decimal-reconcile");

    const ledger = await prisma.sellerTransaction.findMany({
      where: { sellerId: fixture.seller.id, status: "PAID" },
    });
    const sum = ledger.reduce((value, row) => value.plus(row.netAmount), new Prisma.Decimal(0));
    expect(sum.isZero()).toBe(true);
    expect(ledger.find((row) => row.entryType === "PAYMENT_CREDIT")?.netAmount.equals("0.270")).toBe(
      true
    );
    expect(
      ledger.find((row) => row.entryType === "REFUND_COMPENSATION")?.netAmount.equals("-0.270")
    ).toBe(true);
    expect(await commissionsService.reconcileSellerLedger()).toMatchObject({ corrected: 0 });
    expect(await commissionsService.reconcileSellerLedger()).toMatchObject({ corrected: 0 });
  });

  it("rolls back COMPLETED state, compensation, and balance together on local failure", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("atomic-completion-rollback")
    );
    await paymentsService.confirmPayment(order.id);
    const refund = await createObligation(order.id, "CAPTURE-atomic-completion-rollback");

    await prisma.seller.update({
      where: { id: fixture.seller.id },
      data: { balance: new Prisma.Decimal(0) },
    });
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Seller"
      ADD CONSTRAINT "Seller_balance_non_negative_task0013_test" CHECK ("balance" >= 0)
    `);

    try {
      await expect(completeRefund(refund.id, "REFUND-atomic-completion-rollback")).rejects.toBeDefined();

      const unchanged = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
      expect(unchanged.status).toBe("PENDING");
      expect(unchanged.providerRefundId).toBeNull();
      expect(unchanged.completedAt).toBeNull();
      expect(await prisma.sellerTransaction.count({ where: { refundId: refund.id } })).toBe(0);
      const seller = await prisma.seller.findUniqueOrThrow({ where: { id: fixture.seller.id } });
      expect(seller.balance.isZero()).toBe(true);
    } finally {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Seller" DROP CONSTRAINT IF EXISTS "Seller_balance_non_negative_task0013_test"
      `);
    }
  });
});
