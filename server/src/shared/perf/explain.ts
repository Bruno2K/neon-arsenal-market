import { prisma } from "../database/index.js";
import type { ExplainResult } from "./plan.js";

export async function explainAnalyze(sql: string): Promise<ExplainResult> {
  const rows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": ExplainResult[] }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`
  );
  const plan = rows[0]?.["QUERY PLAN"]?.[0];
  if (!plan?.Plan) {
    throw new Error("EXPLAIN ANALYZE returned no plan");
  }
  return plan;
}
