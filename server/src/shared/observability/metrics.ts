import { metrics, type Attributes, type Counter, type Histogram, type Meter } from "@opentelemetry/api";
import { safeAttributes } from "./redact.js";

const METER_NAME = "neon-arsenal-api";

type Instruments = {
  httpRequestDuration: Histogram;
  httpRequestCount: Counter;
  httpErrorCount: Counter;
  dbDuration: Histogram;
  dbErrors: Counter;
  paypalRequestCount: Counter;
  paypalErrorCount: Counter;
  paypalTimeoutCount: Counter;
  paypalDuration: Histogram;
  ordersCreated: Counter;
  ordersCreationFailed: Counter;
  ordersIdempotencyReplay: Counter;
  ordersIdempotencyConflict: Counter;
  reservationsCreated: Counter;
  reservationsConflict: Counter;
  reservationsExpired: Counter;
  paymentsConfirmed: Counter;
  paymentsFailed: Counter;
  webhooksReceived: Counter;
  webhooksDuplicate: Counter;
  webhooksIgnored: Counter;
  webhooksFailed: Counter;
};

let instruments: Instruments | undefined;

function createInstruments(meter: Meter): Instruments {
  return {
    httpRequestDuration: meter.createHistogram("http.server.request.duration", {
      description: "HTTP server request duration",
      unit: "s",
    }),
    httpRequestCount: meter.createCounter("http.server.request.count", {
      description: "HTTP server requests",
    }),
    httpErrorCount: meter.createCounter("http.server.errors", {
      description: "HTTP server 5xx responses",
    }),
    dbDuration: meter.createHistogram("db.client.operation.duration", {
      description: "Prisma/PostgreSQL operation duration",
      unit: "s",
    }),
    dbErrors: meter.createCounter("db.client.errors", {
      description: "Prisma/PostgreSQL operation errors",
    }),
    paypalRequestCount: meter.createCounter("paypal.client.request.count", {
      description: "PayPal HTTP requests",
    }),
    paypalErrorCount: meter.createCounter("paypal.client.errors", {
      description: "PayPal HTTP errors",
    }),
    paypalTimeoutCount: meter.createCounter("paypal.client.timeouts", {
      description: "PayPal HTTP timeouts",
    }),
    paypalDuration: meter.createHistogram("paypal.client.request.duration", {
      description: "PayPal HTTP request duration",
      unit: "s",
    }),
    ordersCreated: meter.createCounter("orders.created", { description: "Orders created" }),
    ordersCreationFailed: meter.createCounter("orders.creation_failed", {
      description: "Order creation failures",
    }),
    ordersIdempotencyReplay: meter.createCounter("orders.idempotency_replay", {
      description: "Idempotent order replays",
    }),
    ordersIdempotencyConflict: meter.createCounter("orders.idempotency_conflict", {
      description: "Idempotency key conflicts",
    }),
    reservationsCreated: meter.createCounter("reservations.created", {
      description: "Listings reserved",
    }),
    reservationsConflict: meter.createCounter("reservations.conflict", {
      description: "Reservation conflicts",
    }),
    reservationsExpired: meter.createCounter("reservations.expired", {
      description: "Reservations expired",
    }),
    paymentsConfirmed: meter.createCounter("payments.confirmed", {
      description: "Payments confirmed",
    }),
    paymentsFailed: meter.createCounter("payments.failed", {
      description: "Payment confirmation failures",
    }),
    webhooksReceived: meter.createCounter("paypal.webhooks.received", {
      description: "PayPal webhooks received",
    }),
    webhooksDuplicate: meter.createCounter("paypal.webhooks.duplicate", {
      description: "Duplicate PayPal webhooks",
    }),
    webhooksIgnored: meter.createCounter("paypal.webhooks.ignored", {
      description: "Ignored PayPal webhooks",
    }),
    webhooksFailed: meter.createCounter("paypal.webhooks.failed", {
      description: "Failed PayPal webhooks",
    }),
  };
}

function getInstruments(): Instruments {
  if (!instruments) {
    instruments = createInstruments(metrics.getMeter(METER_NAME));
  }
  return instruments;
}

export function resetMetricInstruments() {
  instruments = undefined;
}

function add(instrument: Counter, attrs?: Attributes, value = 1) {
  instrument.add(value, safeAttributes(attrs));
}

export const appMetrics = {
  recordHttpRequest(attrs: { method: string; route: string; statusCode: number }, durationSeconds: number) {
    const current = getInstruments();
    const attributes = {
      "http.request.method": attrs.method,
      "http.route": attrs.route,
      "http.response.status_code": attrs.statusCode,
    };
    current.httpRequestCount.add(1, attributes);
    current.httpRequestDuration.record(durationSeconds, attributes);
    if (attrs.statusCode >= 500) {
      current.httpErrorCount.add(1, attributes);
    }
  },

  recordDbOperation(attrs: { operation: string; model: string }, durationSeconds: number, failed: boolean) {
    const current = getInstruments();
    const attributes = { "db.system": "postgresql", "db.operation": attrs.operation, "db.collection": attrs.model };
    current.dbDuration.record(durationSeconds, attributes);
    if (failed) current.dbErrors.add(1, attributes);
  },

  recordPaypalRequest(
    operation: string,
    durationSeconds: number,
    result: "success" | "error" | "timeout",
    statusCode?: number
  ) {
    const current = getInstruments();
    const attributes = {
      "paypal.operation": operation,
      ...(statusCode !== undefined ? { "http.response.status_code": statusCode } : {}),
    };
    current.paypalRequestCount.add(1, attributes);
    current.paypalDuration.record(durationSeconds, attributes);
    if (result === "error") current.paypalErrorCount.add(1, attributes);
    if (result === "timeout") current.paypalTimeoutCount.add(1, attributes);
  },

  ordersCreated: (value = 1) => add(getInstruments().ordersCreated, undefined, value),
  ordersCreationFailed: (value = 1) => add(getInstruments().ordersCreationFailed, undefined, value),
  ordersIdempotencyReplay: (value = 1) => add(getInstruments().ordersIdempotencyReplay, undefined, value),
  ordersIdempotencyConflict: (value = 1) => add(getInstruments().ordersIdempotencyConflict, undefined, value),
  reservationsCreated: (value = 1) => add(getInstruments().reservationsCreated, undefined, value),
  reservationsConflict: (value = 1) => add(getInstruments().reservationsConflict, undefined, value),
  reservationsExpired: (value = 1) => add(getInstruments().reservationsExpired, undefined, value),
  paymentsConfirmed: (value = 1) => add(getInstruments().paymentsConfirmed, undefined, value),
  paymentsFailed: (value = 1) => add(getInstruments().paymentsFailed, undefined, value),
  webhooksReceived: (value = 1) => add(getInstruments().webhooksReceived, undefined, value),
  webhooksDuplicate: (value = 1) => add(getInstruments().webhooksDuplicate, undefined, value),
  webhooksIgnored: (value = 1) => add(getInstruments().webhooksIgnored, undefined, value),
  webhooksFailed: (value = 1) => add(getInstruments().webhooksFailed, undefined, value),
};
