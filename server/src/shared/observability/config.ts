export type TelemetryExporterKind = "none" | "console" | "otlp";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function readTelemetryConfig() {
  const enabled = parseBoolean(process.env.OTEL_ENABLED, false);
  const rawExporter = (process.env.OTEL_EXPORTER ?? "none").trim().toLowerCase();
  const exporter: TelemetryExporterKind =
    rawExporter === "console" || rawExporter === "otlp" ? rawExporter : "none";

  return {
    enabled,
    exporter,
    serviceName: process.env.OTEL_SERVICE_NAME?.trim() || "neon-arsenal-api",
    otlpTracesUrl: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim()
      || process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim(),
    otlpMetricsUrl: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT?.trim()
      || process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim(),
  };
}

export function isTelemetryEnabled() {
  return readTelemetryConfig().enabled;
}
