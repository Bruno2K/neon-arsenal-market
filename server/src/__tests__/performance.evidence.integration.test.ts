import { describe, expect, it } from "vitest";
import { prisma } from "../shared/database/index.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { createOrder, createUser, orderKey } from "./helpers/index.js";
import { explainAnalyze } from "../shared/perf/explain.js";
import { timeAsync } from "../shared/perf/measure.js";
import { indexNames, usesIndexAccess } from "../shared/perf/plan.js";
import { PERF_QUERIES } from "../shared/perf/queries.js";
import { seedPerformanceCatalog } from "../shared/perf/seed.js";

describe("P1.4 performance evidence", () => {
  it("uses hot-path indexes and records order/listing/payment timings", async () => {
    const seeded = await seedPerformanceCatalog();
    const active = await prisma.listing.findMany({
      where: { status: "ACTIVE" },
      take: 6,
      select: { id: true },
    });
    expect(active.length).toBeGreaterThanOrEqual(6);

    const market = await explainAnalyze(PERF_QUERIES.marketActiveCreatedAt);
    expect(usesIndexAccess(market.Plan, "Listing"), indexNames(market.Plan).join(",")).toBe(true);
    expect(indexNames(market.Plan).some((name) => name.includes("status_createdAt"))).toBe(true);

    // COUNT(*) of ACTIVE listings is the pagination-total cost. At a few thousand
    // rows PostgreSQL may still seq-scan; the evidence is the execution time, not
    // a forced index-only scan.
    const countPlan = await explainAnalyze(PERF_QUERIES.marketActiveCount);
    expect(countPlan.Plan).toBeDefined();

    const expireExact = await explainAnalyze(`
      SELECT l.id
      FROM "Listing" l
      WHERE l.status = 'RESERVED' AND l."reservationExpiresAt" <= NOW()
    `);
    expect(
      indexNames(expireExact.Plan).some((name) => name.includes("reservationExpiresAt")),
      indexNames(expireExact.Plan).join(",")
    ).toBe(true);

    const expireWithNulls = await explainAnalyze(PERF_QUERIES.expireReserved);
    expect(expireWithNulls.Plan).toBeDefined();

    const reconcile = await explainAnalyze(PERF_QUERIES.reconcilePendingPaypal);
    expect(usesIndexAccess(reconcile.Plan, "Order"), indexNames(reconcile.Plan).join(",")).toBe(true);
    expect(indexNames(reconcile.Plan).some((name) => name.includes("paymentStatus"))).toBe(true);

    const tableIndexes = await prisma.$queryRaw<Array<{ tablename: string; indexname: string }>>`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('Listing', 'Order', 'OrderIdempotencyKey', 'PaymentWebhookEvent')
    `;
    const names = tableIndexes.map((row) => row.indexname);
    expect(names).toContain("Listing_status_createdAt_idx");
    expect(names).toContain("Listing_status_reservationExpiresAt_idx");
    expect(names).toContain("Order_paymentStatus_status_updatedAt_idx");
    expect(names).toContain("OrderIdempotencyKey_customerId_key_key");
    expect(names).toContain("PaymentWebhookEvent_provider_externalEventId_key");
    expect(names).not.toContain("Listing_status_idx");
    expect(names).not.toContain("Order_paymentStatus_idx");

    await prisma.orderIdempotencyKey.create({
      data: {
        customerId: seeded.customer.id,
        key: "perf-lookup",
        requestHash: "hash",
        status: "COMPLETED",
      },
    });
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: "PAYPAL",
        externalEventId: "WH-PERF-1",
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        status: "PROCESSED",
      },
    });

    const buyer = await createUser({ name: "Perf Checkout Buyer", role: "CUSTOMER" });
    const listTiming = await timeAsync(
      () => listingsService.list({ status: "ACTIVE", page: 1, limit: 20 }),
      8
    );
    const getTiming = await timeAsync(() => listingsService.getById(active[0].id), 8);

    const createDurations = [];
    const confirmDurations = [];
    for (let index = 0; index < 3; index += 1) {
      const listingId = active[index + 1].id;
      const created = await timeAsync(
        () => createOrder(buyer.id, [listingId], orderKey(`perf-${index}`)),
        1
      );
      createDurations.push(created);
      const order = await prisma.order.findFirstOrThrow({
        where: { customerId: buyer.id, items: { some: { listingId } } },
        select: { id: true },
      });
      const confirmed = await timeAsync(() => paymentsService.confirmPayment(order.id), 1);
      confirmDurations.push(confirmed);
    }

    expect(listTiming.p95Ms).toBeGreaterThan(0);
    expect(listTiming.p95Ms).toBeLessThan(2_000);
    expect(getTiming.p95Ms).toBeLessThan(1_000);
    expect(createDurations[0].p95Ms).toBeLessThan(2_000);
    expect(confirmDurations[0].p95Ms).toBeLessThan(2_000);

    expect(market["Execution Time"]).toBeGreaterThan(0);
    expect(countPlan["Execution Time"]).toBeGreaterThan(0);
  });
});
