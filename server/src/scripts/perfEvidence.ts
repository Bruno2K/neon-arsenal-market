import { prisma } from "../shared/database/index.js";
import { explainAnalyze } from "../shared/perf/explain.js";
import { indexNames, usesIndexAccess } from "../shared/perf/plan.js";
import { PERF_QUERIES } from "../shared/perf/queries.js";
import { seedPerformanceCatalog } from "../shared/perf/seed.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { timeAsync } from "../shared/perf/measure.js";

function summarize(name: string, sql: string, plan: Awaited<ReturnType<typeof explainAnalyze>>) {
  return {
    name,
    sql: sql.replace(/\s+/g, " ").trim(),
    executionMs: plan["Execution Time"] ?? null,
    planningMs: plan["Planning Time"] ?? null,
    indexAccess: usesIndexAccess(plan.Plan, "Listing") || usesIndexAccess(plan.Plan, "Order") || usesIndexAccess(plan.Plan, "OrderIdempotencyKey") || usesIndexAccess(plan.Plan, "PaymentWebhookEvent"),
    indexes: indexNames(plan.Plan),
  };
}

async function main() {
  await seedPerformanceCatalog();
  const queries = [
    ["marketActiveCreatedAt", PERF_QUERIES.marketActiveCreatedAt],
    ["marketActiveCount", PERF_QUERIES.marketActiveCount],
    ["marketActivePriceRange", PERF_QUERIES.marketActivePriceRange],
    ["expireReserved", PERF_QUERIES.expireReserved],
    ["reconcilePendingPaypal", PERF_QUERIES.reconcilePendingPaypal],
    ["cancelUnpaidWithoutHold", PERF_QUERIES.cancelUnpaidWithoutHold],
  ] as const;

  const explains = [];
  for (const [name, sql] of queries) {
    explains.push(summarize(name, sql, await explainAnalyze(sql)));
  }

  const list = await timeAsync(() => listingsService.list({ status: "ACTIVE", page: 1, limit: 20 }), 10);
  const report = { explains, list };
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
