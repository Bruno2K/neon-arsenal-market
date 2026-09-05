import { InMemorySpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import {
  InMemoryMetricExporter,
  type MetricData,
} from "@opentelemetry/sdk-metrics";
import { flushTelemetry, getStartedTelemetry, startTestTelemetry, shutdownTelemetry } from "./sdk.js";

export async function useTestTelemetry() {
  const started = await startTestTelemetry();
  if (!started) {
    throw new Error("Test telemetry failed to start");
  }
  return started;
}

export async function resetTestTelemetry() {
  const started = getStartedTelemetry();
  if (started?.spanExporter instanceof InMemorySpanExporter) {
    started.spanExporter.reset();
  }
  if (started?.metricExporter instanceof InMemoryMetricExporter) {
    started.metricExporter.reset();
  }
}

export async function collectSpans(): Promise<ReadableSpan[]> {
  await flushTelemetry();
  const started = getStartedTelemetry();
  if (!(started?.spanExporter instanceof InMemorySpanExporter)) return [];
  return started.spanExporter.getFinishedSpans();
}

export async function collectMetrics(): Promise<MetricData[]> {
  await flushTelemetry();
  const started = getStartedTelemetry();
  if (!(started?.metricExporter instanceof InMemoryMetricExporter)) return [];
  return started.metricExporter.getMetrics().flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
}

export function metricByName(metrics: MetricData[], name: string) {
  return metrics.find((metric) => metric.descriptor.name === name);
}

export function metricPoints(metrics: MetricData[], name: string) {
  return metricByName(metrics, name)?.dataPoints ?? [];
}

export function sumMetric(metrics: MetricData[], name: string) {
  return metricPoints(metrics, name).reduce((total, point) => {
    const value = point.value;
    if (typeof value === "number") return total + value;
    return total + value.count;
  }, 0);
}

export function spanNames(spans: ReadableSpan[]) {
  return spans.map((span) => span.name);
}

export function spansNamed(spans: ReadableSpan[], name: string) {
  return spans.filter((span) => span.name === name);
}

export function spanOutcomes(spans: ReadableSpan[], name: string) {
  return spansNamed(spans, name).map((span) => span.attributes["app.outcome"]);
}

const FORBIDDEN_ATTR_KEYS = /password|passwd|secret|token|authorization|cookie|jwt|signature|credential|access_token|paypal-transmission-sig/i;
const HIGH_CARDINALITY_KEYS = /user[_]?id|order[_]?id|listing[_]?id|email|customer[_]?id/i;

export function telemetryContainsSensitive(spans: ReadableSpan[], metrics: MetricData[]) {
  const spanHit = spans.some((span) =>
    Object.entries(span.attributes).some(
      ([key, value]) => FORBIDDEN_ATTR_KEYS.test(key) || (typeof value === "string" && FORBIDDEN_ATTR_KEYS.test(value))
    )
  );
  const metricHit = metrics.some((metric) =>
    metric.dataPoints.some((point) =>
      Object.keys(point.attributes ?? {}).some((key) => FORBIDDEN_ATTR_KEYS.test(key) || HIGH_CARDINALITY_KEYS.test(key))
    )
  );
  return spanHit || metricHit;
}

export function metricAttributeKeys(metrics: MetricData[], name: string) {
  return new Set(metricPoints(metrics, name).flatMap((point) => Object.keys(point.attributes ?? {})));
}

export { shutdownTelemetry };
