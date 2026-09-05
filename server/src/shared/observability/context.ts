import { AsyncLocalStorage } from "node:async_hooks";
import { context, trace } from "@opentelemetry/api";

type RequestStore = { requestId: string };

const requestStore = new AsyncLocalStorage<RequestStore>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestStore.run({ requestId }, fn);
}

export function getRequestId() {
  return requestStore.getStore()?.requestId;
}

export function getTraceContext() {
  const span = trace.getSpan(context.active());
  const spanContext = span?.spanContext();
  if (!spanContext || !spanContext.traceId || spanContext.traceId === "00000000000000000000000000000000") {
    return {};
  }
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
  };
}

export function getLogBindings() {
  return {
    requestId: getRequestId(),
    ...getTraceContext(),
  };
}
