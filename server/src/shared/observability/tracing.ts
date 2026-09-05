import { context, SpanKind, SpanStatusCode, trace, type Span, type AttributeValue } from "@opentelemetry/api";
import { safeAttributes } from "./redact.js";
import { classifyThrownError, isBusinessError, markSpanOutcome, type BusinessOutcome } from "./outcomes.js";

function getTracer() {
  return trace.getTracer("neon-arsenal-api");
}

export async function withSpan<T>(
  name: string,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, AttributeValue | undefined>;
    outcomeOnSuccess?: BusinessOutcome;
  },
  fn: (span: Span) => Promise<T> | T
): Promise<T> {
  return getTracer().startActiveSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: safeAttributes(options.attributes),
    },
    async (span) => {
      try {
        const result = await fn(span);
        if (options.outcomeOnSuccess) {
          markSpanOutcome(span, options.outcomeOnSuccess);
        }
        return result;
      } catch (err) {
        const outcome = classifyThrownError(err);
        markSpanOutcome(span, outcome);
        if (!isBusinessError(err)) {
          span.recordException(err instanceof Error ? err : new Error("unknown_error"));
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err instanceof Error ? err.name : "unknown_error",
          });
        }
        throw err;
      } finally {
        span.end();
      }
    }
  );
}

export function currentSpan() {
  return trace.getSpan(context.active());
}
