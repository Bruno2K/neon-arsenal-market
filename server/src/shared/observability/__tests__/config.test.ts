import { afterEach, describe, expect, it } from "vitest";
import { readTelemetryConfig } from "../config.js";

describe("readTelemetryConfig", () => {
  const keys = [
    "OTEL_ENABLED",
    "OTEL_EXPORTER",
    "OTEL_SERVICE_NAME",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("is disabled by default and does not select an exporter", () => {
    for (const key of keys) delete process.env[key];
    expect(readTelemetryConfig()).toMatchObject({
      enabled: false,
      exporter: "none",
      serviceName: "neon-arsenal-api",
    });
  });

  it("accepts only known exporters", () => {
    process.env.OTEL_ENABLED = "true";
    process.env.OTEL_EXPORTER = "console";
    expect(readTelemetryConfig().exporter).toBe("console");
    process.env.OTEL_EXPORTER = "otlp";
    expect(readTelemetryConfig().exporter).toBe("otlp");
    process.env.OTEL_EXPORTER = "jaeger";
    expect(readTelemetryConfig().exporter).toBe("none");
  });
});
