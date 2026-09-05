import type { PrismaClient } from "@prisma/client";
import { SpanKind } from "@opentelemetry/api";
import { appMetrics } from "./metrics.js";
import { withSpan } from "./tracing.js";

type PrismaClientLike = PrismaClient & {
  $extends: (extension: unknown) => PrismaClient;
};

export function withPrismaObservability(client: PrismaClient): PrismaClient {
  const observable = (client as PrismaClientLike).$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const collection = model ?? "raw";
        const started = process.hrtime.bigint();
        let failed = false;
        try {
          return await withSpan(
            "db.prisma",
            {
              kind: SpanKind.CLIENT,
              attributes: {
                "db.system": "postgresql",
                "db.operation": operation,
                "db.collection": collection,
              },
            },
            () => query(args)
          );
        } catch (err) {
          failed = true;
          throw err;
        } finally {
          const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
          appMetrics.recordDbOperation({ operation, model: collection }, durationSeconds, failed);
        }
      },
    },
  });

  return observable as PrismaClient;
}
