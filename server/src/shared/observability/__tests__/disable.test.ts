import { afterAll, describe, expect, it } from "vitest";
import { startTelemetry, shutdownTelemetry } from "../sdk.js";
import { collectSpans } from "../test.js";
import { withSpan } from "../tracing.js";

describe("telemetry disable and exporter isolation", () => {
  afterAll(async () => {
    await shutdownTelemetry();
    delete process.env.OTEL_ENABLED;
    delete process.env.OTEL_EXPORTER;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  it("does not require an exporter and stays no-op when disabled", async () => {
    delete process.env.OTEL_ENABLED;
    delete process.env.OTEL_EXPORTER;
    await shutdownTelemetry();
    const started = await startTelemetry();
    expect(started).toBeUndefined();

    await expect(
      withSpan("orders.create", {}, async () => {
        return { ok: true };
      })
    ).resolves.toEqual({ ok: true });
    expect(await collectSpans()).toEqual([]);
  });

  it("does not crash when an OTLP exporter URL is unreachable", async () => {
    process.env.OTEL_ENABLED = "true";
    process.env.OTEL_EXPORTER = "otlp";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:1/v1/traces";
    await shutdownTelemetry();
    const started = await startTelemetry();
    expect(started).toBeDefined();
    await expect(withSpan("orders.create", {}, async () => "ok")).resolves.toBe("ok");
    await shutdownTelemetry();
  });
});
