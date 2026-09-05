import { createServer } from "node:http";
import { SpanStatusCode } from "@opentelemetry/api";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../../errors/AppError.js";
import { errorHandler } from "../../errors/errorHandler.js";
import { requestId } from "../../middlewares/requestId.js";
import { getLogBindings, getRequestId } from "../context.js";
import { httpTelemetry } from "../http.js";
import { appMetrics } from "../metrics.js";
import { withPaypalOperation } from "../paypal.js";
import {
  collectMetrics,
  collectSpans,
  metricAttributeKeys,
  resetTestTelemetry,
  shutdownTelemetry,
  spansNamed,
  sumMetric,
  telemetryContainsSensitive,
  useTestTelemetry,
} from "../test.js";
import { withSpan } from "../tracing.js";

describe("OpenTelemetry runtime", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeAll(async () => {
    await useTestTelemetry();
    const app = express();
    app.use(requestId);
    app.use(httpTelemetry);
    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });
    app.get("/orders/:id", (req, res) => {
      const bindings = getLogBindings();
      res.json({
        requestId: req.requestId,
        alsRequestId: getRequestId(),
        trace_id: bindings.trace_id,
        span_id: bindings.span_id,
      });
    });
    app.get("/boom", () => {
      throw new Error("unexpected boom");
    });
    app.use((_req, res) => {
      res.status(404).json({ error: "not found" });
    });
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = createServer(app);
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await shutdownTelemetry();
  });

  beforeEach(async () => {
    await resetTestTelemetry();
  });

  it("preserves the existing request ID and correlates it with the server span", async () => {
    const res = await fetch(`${baseUrl}/orders/abc`, {
      headers: { "x-request-id": "req-correlation-1" },
    });
    const body = (await res.json()) as {
      requestId?: string;
      alsRequestId?: string;
      trace_id?: string;
    };

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req-correlation-1");
    expect(body.requestId).toBe("req-correlation-1");
    expect(body.alsRequestId).toBe("req-correlation-1");
    expect(body.trace_id).toMatch(/^[0-9a-f]{32}$/);

    const spans = await collectSpans();
    const serverSpans = spansNamed(spans, "http.server.request");
    expect(serverSpans).toHaveLength(1);
    expect(serverSpans[0]?.attributes["request.id"]).toBe("req-correlation-1");
    expect(serverSpans[0]?.attributes["http.route"]).toBe("/orders/:id");
    expect(serverSpans[0]?.attributes["http.request.method"]).toBe("GET");
    expect(serverSpans[0]?.spanContext().traceId).toBe(body.trace_id);
  });

  it("records low-cardinality HTTP metrics and skips /health", async () => {
    await fetch(`${baseUrl}/health`);
    await fetch(`${baseUrl}/orders/xyz`);
    await fetch(`${baseUrl}/missing-path`);

    const spans = await collectSpans();
    expect(spansNamed(spans, "http.server.request").map((span) => span.attributes["http.route"])).toEqual(
      expect.arrayContaining(["/orders/:id", "unmatched"])
    );
    expect(spans.some((span) => span.attributes["url.path"] === "/health")).toBe(false);

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "http.server.request.count")).toBeGreaterThanOrEqual(2);
    expect(metricAttributeKeys(metrics, "http.server.request.count")).toEqual(
      new Set(["http.request.method", "http.route", "http.response.status_code"])
    );
    const routes = metrics
      .find((metric) => metric.descriptor.name === "http.server.request.count")
      ?.dataPoints.map((point) => point.attributes["http.route"]);
    expect(routes).toEqual(expect.arrayContaining(["/orders/:id", "unmatched"]));
    expect(routes?.some((route) => route === "/orders/xyz" || route === "/missing-path")).toBe(false);
  });

  it("marks unexpected HTTP 5xx as errors without leaking the exception payload into attributes", async () => {
    const res = await fetch(`${baseUrl}/boom`);
    expect(res.status).toBe(500);

    const spans = await collectSpans();
    const serverSpan = spansNamed(spans, "http.server.request")[0];
    expect(serverSpan?.status.code).toBe(SpanStatusCode.ERROR);
    expect(serverSpan?.attributes["http.response.status_code"]).toBe(500);
    expect(JSON.stringify(serverSpan?.attributes)).not.toMatch(/unexpected boom/);

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "http.server.errors")).toBeGreaterThanOrEqual(1);
  });

  it("does not mark expected business errors as span ERROR", async () => {
    await expect(
      withSpan("orders.create", {}, async () => {
        throw new AppError(409, "Idempotency key was already used with a different order request");
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    const spans = await collectSpans();
    const span = spansNamed(spans, "orders.create")[0];
    expect(span?.attributes["app.outcome"]).toBe("idempotency_conflict");
    expect(span?.status.code).toBe(SpanStatusCode.UNSET);
  });

  it("marks operational failures as ERROR and records PayPal timeout metrics", async () => {
    await expect(
      withPaypalOperation("orders_create", async () => {
        throw new AppError(504, "PayPal OrdersCreate timed out");
      })
    ).rejects.toMatchObject({ statusCode: 504 });

    const spans = await collectSpans();
    const span = spansNamed(spans, "paypal.orders_create")[0];
    expect(span?.attributes["paypal.operation"]).toBe("orders_create");
    expect(span?.attributes["app.outcome"]).toBe("timeout");
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.name).not.toContain("PAYPAL-");

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "paypal.client.timeouts")).toBe(1);
    expect(metricAttributeKeys(metrics, "paypal.client.request.count")).toEqual(
      new Set(["paypal.operation"])
    );
  });

  it("records business counters without high-cardinality attributes", async () => {
    appMetrics.ordersCreated();
    appMetrics.ordersIdempotencyReplay();
    appMetrics.ordersIdempotencyConflict();
    appMetrics.reservationsCreated();
    appMetrics.reservationsConflict();
    appMetrics.reservationsExpired();
    appMetrics.paymentsConfirmed();
    appMetrics.paymentsFailed();
    appMetrics.webhooksReceived();
    appMetrics.webhooksDuplicate();
    appMetrics.webhooksIgnored();
    appMetrics.webhooksFailed();

    const metrics = await collectMetrics();
    expect(sumMetric(metrics, "orders.created")).toBe(1);
    expect(sumMetric(metrics, "orders.idempotency_replay")).toBe(1);
    expect(sumMetric(metrics, "orders.idempotency_conflict")).toBe(1);
    expect(sumMetric(metrics, "reservations.conflict")).toBe(1);
    expect(sumMetric(metrics, "paypal.webhooks.duplicate")).toBe(1);
    expect(telemetryContainsSensitive(await collectSpans(), metrics)).toBe(false);
  });

  it("strips secrets from span attributes", async () => {
    await withSpan(
      "security.check",
      {
        attributes: {
          authorization: "Bearer secret-token",
          password: "hunter2",
          jwt: "eyJhbGciOiJIUzI1NiJ9.e30.sig",
          "paypal-transmission-sig": "sig",
          access_token: "PAYPAL-ACCESS",
          "http.request.method": "POST",
        },
      },
      async () => "ok"
    );

    const spans = await collectSpans();
    const span = spansNamed(spans, "security.check")[0];
    expect(span?.attributes["http.request.method"]).toBe("POST");
    expect(span?.attributes.authorization).toBeUndefined();
    expect(span?.attributes.password).toBeUndefined();
    expect(span?.attributes.jwt).toBeUndefined();
    expect(span?.attributes["paypal-transmission-sig"]).toBeUndefined();
    expect(span?.attributes.access_token).toBeUndefined();
    expect(telemetryContainsSensitive(spans, await collectMetrics())).toBe(false);
  });
});
