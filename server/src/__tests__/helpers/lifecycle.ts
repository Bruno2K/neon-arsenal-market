import { prisma } from "../../shared/database/index.js";

/**
 * Application tables that integration tests may write.
 *
 * `_prisma_migrations` is intentionally omitted so `prisma migrate deploy`
 * remains the source of schema truth for the suite.
 *
 * `TRUNCATE ... CASCADE` is appropriate for this schema: every business table
 * participates in a foreign-key graph, tests must start from an empty
 * committed state (transaction-per-test rollback cannot prove concurrency),
 * and a single statement is cheaper and less fragile than ordered
 * `deleteMany` chains copied across files.
 */
export const BUSINESS_TABLES = [
  "Review",
  "SellerTransaction",
  "PaymentWebhookEvent",
  "OrderItem",
  "OrderIdempotencyKey",
  "PriceHistory",
  "Listing",
  "Order",
  "Product",
  "Seller",
  "PendingRegistration",
  "RevokedToken",
  "User",
] as const;

export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

export async function resetBusinessTables() {
  const qualified = BUSINESS_TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`);
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
