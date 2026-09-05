import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";
import { getRequestId } from "./context.js";
import { appMetrics } from "./metrics.js";
import { safeAttributes } from "./redact.js";

const SKIP_ROUTES = new Set(["/health", "/ready"]);

function normalizeRoute(req: Request) {
  const routePath = req.route?.path;
  if (typeof routePath === "string") {
    return `${req.baseUrl || ""}${routePath}` || "unmatched";
  }
  if (Array.isArray(routePath) && routePath[0]) {
    return `${req.baseUrl || ""}${String(routePath[0])}`;
  }
  return "unmatched";
}

export function httpTelemetry(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_ROUTES.has(req.path)) {
    next();
    return;
  }

  const start = process.hrtime.bigint();
  const extracted = propagation.extract(context.active(), req.headers);

  const span = trace.getTracer("neon-arsenal-api").startSpan(
    "http.server.request",
    {
      kind: SpanKind.SERVER,
      attributes: safeAttributes({
        "http.request.method": req.method,
        "url.path": req.path,
        "request.id": getRequestId() ?? req.requestId,
      }),
    },
    extracted
  );

  const spanContext = trace.setSpan(extracted, span);

  const finish = () => {
    res.off("finish", finish);
    res.off("close", finish);
    const route = normalizeRoute(req);
    const statusCode = res.statusCode || 500;
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    span.setAttributes(
      safeAttributes({
        "http.route": route,
        "http.response.status_code": statusCode,
      })
    );
    if (statusCode >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    appMetrics.recordHttpRequest({ method: req.method, route, statusCode }, durationSeconds);
    span.end();
  };

  res.on("finish", finish);
  res.on("close", finish);

  context.with(spanContext, () => next());
}

export function injectTraceHeaders(headers: Record<string, string> = {}) {
  propagation.inject(context.active(), headers);
  return headers;
}
