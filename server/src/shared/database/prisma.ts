import { PrismaClient } from "@prisma/client";
import { withPrismaObservability } from "../observability/prisma.js";

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

const baseClient =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = baseClient;
}

export const prisma = withPrismaObservability(baseClient);

export async function disconnectPrisma(): Promise<void> {
  await baseClient.$disconnect();
}
