import { metrics, trace } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  AggregationTemporality,
  ConsoleMetricExporter,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type PushMetricExporter,
} from "@opentelemetry/sdk-metrics";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { readTelemetryConfig } from "./config.js";
import { resetMetricInstruments } from "./metrics.js";

type StartedTelemetry = {
  tracerProvider: NodeTracerProvider;
  meterProvider: MeterProvider;
  spanExporter?: SpanExporter;
  metricExporter?: PushMetricExporter;
};

let started: StartedTelemetry | undefined;

function buildResource(serviceName: string) {
  return resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName });
}

function createTraceExporter(kind: ReturnType<typeof readTelemetryConfig>["exporter"], otlpUrl?: string) {
  if (kind === "console") return new ConsoleSpanExporter();
  if (kind === "otlp") {
    return new OTLPTraceExporter({
      ...(otlpUrl ? { url: otlpUrl } : {}),
      timeoutMillis: 2_000,
    });
  }
  return undefined;
}

function createMetricExporter(kind: ReturnType<typeof readTelemetryConfig>["exporter"], otlpUrl?: string) {
  if (kind === "console") return new ConsoleMetricExporter();
  if (kind === "otlp") {
    return new OTLPMetricExporter({
      ...(otlpUrl ? { url: otlpUrl } : {}),
      timeoutMillis: 2_000,
    });
  }
  return undefined;
}

function createSpanProcessor(exporter?: SpanExporter, mode: "batch" | "simple" = "batch"): SpanProcessor[] {
  if (!exporter) return [];
  return [mode === "simple" ? new SimpleSpanProcessor(exporter) : new BatchSpanProcessor(exporter)];
}

export async function startTelemetry(options?: {
  forceEnabled?: boolean;
  exporter?: ReturnType<typeof readTelemetryConfig>["exporter"];
  spanExporter?: SpanExporter;
  metricExporter?: PushMetricExporter;
  exportIntervalMillis?: number;
}) {
  if (started) return started;

  const config = readTelemetryConfig();
  const enabled = options?.forceEnabled ?? config.enabled;
  if (!enabled) return undefined;

  try {
    const exporterKind = options?.exporter ?? config.exporter;
    const spanExporter = options?.spanExporter ?? createTraceExporter(exporterKind, config.otlpTracesUrl);
    const metricExporter = options?.metricExporter ?? createMetricExporter(exporterKind, config.otlpMetricsUrl);
    const resource = buildResource(config.serviceName);

    const tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: createSpanProcessor(spanExporter, options?.spanExporter ? "simple" : "batch"),
    });
    tracerProvider.register();

    const readers = metricExporter
      ? [
          new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: options?.exportIntervalMillis ?? (options?.metricExporter ? 60_000 : 15_000),
          }),
        ]
      : [];

    const meterProvider = new MeterProvider({ resource, readers });
    metrics.setGlobalMeterProvider(meterProvider);
    resetMetricInstruments();

    started = { tracerProvider, meterProvider, spanExporter, metricExporter };
    return started;
  } catch {
    resetMetricInstruments();
    return undefined;
  }
}

export async function startTestTelemetry() {
  await shutdownTelemetry();
  const spanExporter = new InMemorySpanExporter();
  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.DELTA);
  return startTelemetry({
    forceEnabled: true,
    spanExporter,
    metricExporter,
    exportIntervalMillis: 60_000,
  });
}

export function getStartedTelemetry() {
  return started;
}

export async function flushTelemetry() {
  if (!started) return;
  await started.tracerProvider.forceFlush().catch(() => undefined);
  await started.meterProvider.forceFlush().catch(() => undefined);
}

export async function shutdownTelemetry() {
  if (!started) {
    trace.disable();
    metrics.disable();
    resetMetricInstruments();
    return;
  }
  const current = started;
  started = undefined;
  await current.tracerProvider.shutdown().catch(() => undefined);
  await current.meterProvider.shutdown().catch(() => undefined);
  trace.disable();
  metrics.disable();
  resetMetricInstruments();
}
