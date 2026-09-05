import { SpanKind } from "@opentelemetry/api";
import { AppError } from "../errors/AppError.js";
import { appMetrics } from "./metrics.js";
import { markSpanOutcome } from "./outcomes.js";
import { withSpan } from "./tracing.js";

export async function withPaypalOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  readStatus?: (result: T) => number | undefined
): Promise<T> {
  const started = process.hrtime.bigint();
  return withSpan(
    `paypal.${operation}`,
    {
      kind: SpanKind.CLIENT,
      attributes: { "paypal.operation": operation },
    },
    async (span) => {
      try {
        const result = await fn();
        const statusCode = readStatus?.(result);
        if (statusCode !== undefined) {
          span.setAttribute("http.response.status_code", statusCode);
        }
        markSpanOutcome(span, "confirmed");
        appMetrics.recordPaypalRequest(
          operation,
          Number(process.hrtime.bigint() - started) / 1e9,
          "success",
          statusCode
        );
        return result;
      } catch (err) {
        const timeout = err instanceof AppError && err.statusCode === 504;
        const statusMatch =
          err instanceof Error ? err.message.match(/PayPal OrdersGet failed: (\d+)/) : null;
        const statusCode = statusMatch ? Number(statusMatch[1]) : undefined;
        appMetrics.recordPaypalRequest(
          operation,
          Number(process.hrtime.bigint() - started) / 1e9,
          timeout ? "timeout" : "error",
          statusCode
        );
        throw err;
      }
    }
  );
}
