import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { appMetrics } from "../metrics.js";
import {
  collectMetrics,
  metricAttributeKeys,
  resetTestTelemetry,
  shutdownTelemetry,
  telemetryContainsSensitive,
  useTestTelemetry,
} from "../test.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const CATALOG_PATH = join(REPO_ROOT, "docs/operations/dashboards/neon-arsenal-api.json");

type CatalogInstrument = {
  name: string;
  type: "counter" | "histogram";
  unit: string;
  attributes: string[];
};

type CatalogSpan = {
  name: string;
  file: string;
};

type Catalog = {
  meter: string;
  instruments: CatalogInstrument[];
  spans: CatalogSpan[];
  dashboards: Array<{ id: string; panels: Array<{ instrument: string }> }>;
  security: { forbiddenMetricLabels: string[] };
};

function loadCatalog(): Catalog {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as Catalog;
}

function recordDocumentedMetrics() {
  appMetrics.recordHttpRequest({ method: "GET", route: "/listings", statusCode: 200 }, 0.004);
  appMetrics.recordHttpRequest({ method: "POST", route: "/orders", statusCode: 500 }, 0.02);
  appMetrics.recordDbOperation({ operation: "findMany", model: "Listing" }, 0.001, false);
  appMetrics.recordDbOperation({ operation: "updateMany", model: "Listing" }, 0.002, true);
  appMetrics.recordPaypalRequest("orders_create", 0.2, "success");
  appMetrics.recordPaypalRequest("orders_get", 0.3, "error");
  appMetrics.recordPaypalRequest("orders_capture", 0.4, "timeout");
  appMetrics.ordersCreated();
  appMetrics.ordersCreationFailed();
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
  appMetrics.sellerLedgerDriftDetected();
  appMetrics.sellerLedgerCorrected();
  appMetrics.outboxPublished();
  appMetrics.outboxRetry();
  appMetrics.outboxFailed();
}

describe("documented operational instrument catalog", () => {
  const catalog = loadCatalog();

  beforeAll(async () => {
    await useTestTelemetry();
  });

  afterAll(async () => {
    await shutdownTelemetry();
  });

  beforeEach(async () => {
    await resetTestTelemetry();
  });

  it("lists every meter the dashboards and SLOs cite", () => {
    const names = catalog.instruments.map((instrument) => instrument.name);
    expect(new Set(names).size).toBe(names.length);
    expect(catalog.meter).toBe("neon-arsenal-api");
    expect(catalog.dashboards.map((dashboard) => dashboard.id)).toEqual([
      "api",
      "orders",
      "payments",
      "webhooks",
      "reconciliation",
      "database",
    ]);

    const panelInstruments = catalog.dashboards.flatMap((dashboard) =>
      dashboard.panels.map((panel) => panel.instrument)
    );
    for (const name of panelInstruments) {
      expect(names).toContain(name);
    }
  });

  it("records every documented metric with only the documented attribute keys", async () => {
    recordDocumentedMetrics();

    const metrics = await collectMetrics();
    const recorded = new Set(metrics.map((metric) => metric.descriptor.name));

    for (const instrument of catalog.instruments) {
      expect(recorded, `missing ${instrument.name}`).toContain(instrument.name);
      const keys = [...metricAttributeKeys(metrics, instrument.name)].sort();
      const allowed = [...instrument.attributes].sort();
      expect(keys, instrument.name).toEqual(allowed);
    }

    expect(telemetryContainsSensitive([], metrics)).toBe(false);
    for (const label of catalog.security.forbiddenMetricLabels) {
      for (const instrument of catalog.instruments) {
        expect(metricAttributeKeys(metrics, instrument.name).has(label)).toBe(false);
      }
    }
  });

  it("keeps documented span names in the files that create them", () => {
    for (const span of catalog.spans) {
      const source = readFileSync(join(REPO_ROOT, span.file), "utf8");
      if (span.name === "paypal.") {
        expect(source).toContain("paypal.${operation}");
        continue;
      }
      expect(source, span.file).toContain(`"${span.name}"`);
    }
  });
});
