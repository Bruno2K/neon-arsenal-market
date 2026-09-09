import http from "k6/http";
import { check, fail } from "k6";
import exec from "k6/execution";
import { SharedArray } from "k6/data";
import { Counter, Rate } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const PROFILE = __ENV.LOAD_PROFILE || "smoke";
const RUN_ID = __ENV.RUN_ID || `${Date.now()}`;
const ALLOW_WRITES = __ENV.ALLOW_WRITES === "true";

const orderListingIds = new SharedArray("order-listing-ids", () => csv("ORDER_LISTING_IDS"));
const paymentOrderIds = new SharedArray("payment-order-ids", () => csv("PAYMENT_ORDER_IDS"));

const catalogFailures = new Rate("catalog_failures");
const orderFailures = new Rate("order_failures");
const paymentFailures = new Rate("payment_failures");
const webhookFailures = new Rate("webhook_failures");
const webhookSignatureRejections = new Counter("webhook_signature_rejections");

const profiles = {
  smoke: {
    catalog_browse: {
      executor: "constant-arrival-rate",
      exec: "catalogBrowse",
      rate: intEnv("LOAD_TARGET_RPS", 1),
      timeUnit: "1s",
      duration: __ENV.LOAD_DURATION || "15s",
      preAllocatedVUs: intEnv("LOAD_PREALLOCATED_VUS", 1),
      maxVUs: intEnv("LOAD_MAX_VUS", 2),
    },
  },
  catalog: {
    catalog_browse: {
      executor: "ramping-arrival-rate",
      exec: "catalogBrowse",
      startRate: intEnv("LOAD_START_RPS", 5),
      timeUnit: "1s",
      preAllocatedVUs: intEnv("LOAD_PREALLOCATED_VUS", 20),
      maxVUs: intEnv("LOAD_MAX_VUS", 100),
      stages: [
        { target: intEnv("LOAD_TARGET_RPS", 20), duration: __ENV.LOAD_RAMP_DURATION || "30s" },
        { target: intEnv("LOAD_TARGET_RPS", 20), duration: __ENV.LOAD_HOLD_DURATION || "60s" },
        { target: 0, duration: __ENV.LOAD_COOLDOWN_DURATION || "15s" },
      ],
    },
  },
  orders: {
    order_create: {
      executor: "shared-iterations",
      exec: "orderCreate",
      vus: Math.max(1, Math.min(intEnv("LOAD_VUS", 5), orderListingIds.length || 1)),
      iterations: Math.max(1, orderListingIds.length),
      maxDuration: __ENV.LOAD_MAX_DURATION || "2m",
    },
  },
  payment_replay: {
    payment_replay: {
      executor: "constant-vus",
      exec: "paymentReplay",
      vus: intEnv("LOAD_VUS", 2),
      duration: __ENV.LOAD_DURATION || "30s",
    },
  },
  webhook_rejection: {
    webhook_rejection: {
      executor: "constant-arrival-rate",
      exec: "webhookRejection",
      rate: intEnv("LOAD_TARGET_RPS", 5),
      timeUnit: "1s",
      duration: __ENV.LOAD_DURATION || "30s",
      preAllocatedVUs: intEnv("LOAD_PREALLOCATED_VUS", 5),
      maxVUs: intEnv("LOAD_MAX_VUS", 20),
    },
  },
};

if (!profiles[PROFILE]) {
  throw new Error(`Unknown LOAD_PROFILE=${PROFILE}. Use smoke, catalog, orders, payment_replay, or webhook_rejection.`);
}

export const options = {
  scenarios: profiles[PROFILE],
  summaryTrendStats: ["avg", "min", "med", "max", "p(50)", "p(90)", "p(95)", "p(99)"],
  thresholds: {
    checks: ["rate>0.99"],
    "catalog_failures{scenario:catalog_browse}": ["rate<0.01"],
    "order_failures{scenario:order_create}": ["rate<0.01"],
    "payment_failures{scenario:payment_replay}": ["rate<0.01"],
    "webhook_failures{scenario:webhook_rejection}": ["rate<0.01"],
    "webhook_signature_rejections{scenario:webhook_rejection}": ["count>0"],
    "http_req_duration{scenario:catalog_browse}": ["p(95)<500", "p(99)<1000"],
    "http_req_duration{scenario:order_create}": ["p(95)<1000", "p(99)<2000"],
    "http_req_duration{scenario:payment_replay}": ["p(95)<750", "p(99)<1500"],
    "http_req_duration{scenario:webhook_rejection}": ["p(95)<500", "p(99)<1000"],
  },
};

export function setup() {
  assertProfileInputs();

  if (PROFILE !== "orders" && PROFILE !== "payment_replay") return {};

  const response = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: requiredEnv("CUSTOMER_EMAIL"), password: requiredEnv("CUSTOMER_PASSWORD") }),
    requestParams("auth-login")
  );
  const ok = check(response, { "setup login is 200": (r) => r.status === 200 });
  if (!ok) fail(`Login failed with HTTP ${response.status}`);

  const accessToken = response.json("accessToken");
  if (typeof accessToken !== "string" || !accessToken) fail("Login response has no accessToken");

  if (PROFILE === "payment_replay") {
    for (const orderId of paymentOrderIds) {
      const order = http.get(
        `${BASE_URL}/api/v1/orders/${encodeURIComponent(orderId)}`,
        requestParams("payment-replay-preflight", accessToken)
      );
      const replayable = check(order, {
        "payment replay order is readable": (r) => r.status === 200,
        "payment replay order already has PayPal id": (r) => typeof r.json("paypalOrderId") === "string",
      });
      if (!replayable) {
        fail(`Order ${orderId} is not pre-warmed; refusing a test that could call PayPal OrdersCreate`);
      }
    }
  }
  return { accessToken };
}

export function catalogBrowse() {
  const response = http.get(`${BASE_URL}/api/v1/listings?cursor=&limit=20`, requestParams("catalog-list"));
  const ok = check(response, {
    "catalog is 200": (r) => r.status === 200,
    "catalog returns items": (r) => Array.isArray(r.json("items")),
  });
  catalogFailures.add(!ok);
}

export function orderCreate(data) {
  const index = exec.scenario.iterationInTest;
  const listingId = orderListingIds[index];
  if (!listingId) fail(`No ORDER_LISTING_IDS entry for iteration ${index}`);

  const response = http.post(
    `${BASE_URL}/api/v1/orders`,
    JSON.stringify({ items: [{ listingId }] }),
    requestParams("order-create", data.accessToken, { "Idempotency-Key": `k6-${RUN_ID}-${index}` }, [201])
  );
  const ok = check(response, {
    "order is created": (r) => r.status === 201,
    "order has id": (r) => typeof r.json("id") === "string",
  });
  orderFailures.add(!ok);
}

export function paymentReplay(data) {
  const index = exec.scenario.iterationInTest % paymentOrderIds.length;
  const orderId = paymentOrderIds[index];
  const response = http.post(
    `${BASE_URL}/api/v1/payments/create`,
    JSON.stringify({ orderId }),
    requestParams("payment-link-replay", data.accessToken)
  );
  const ok = check(response, {
    "payment replay is 200": (r) => r.status === 200,
    "payment replay keeps order": (r) => r.json("orderId") === orderId,
    "payment replay has PayPal id": (r) => typeof r.json("paypalOrderId") === "string",
  });
  paymentFailures.add(!ok);
}

export function webhookRejection() {
  const response = http.post(
    `${BASE_URL}/api/v1/payments/webhook`,
    JSON.stringify({ id: `k6-invalid-${RUN_ID}-${exec.scenario.iterationInTest}`, event_type: "PAYMENT.CAPTURE.COMPLETED" }),
    requestParams(
      "webhook-invalid-signature",
      undefined,
      {
        "paypal-transmission-id": "invalid",
        "paypal-transmission-time": new Date().toISOString(),
        "paypal-transmission-sig": "invalid",
        "paypal-cert-url": "https://example.invalid/cert.pem",
        "paypal-auth-algo": "SHA256withRSA",
      },
      [401, 429]
    )
  );
  if (response.status === 401) webhookSignatureRejections.add(1);
  const ok = check(response, {
    "invalid webhook is safely rejected": (r) => r.status === 401 || r.status === 429,
  });
  webhookFailures.add(!ok);
}

export function handleSummary(data) {
  const output = {
    profile: PROFILE,
    baseUrl: BASE_URL,
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    workload: {
      offeredRps:
        PROFILE === "catalog" || PROFILE === "webhook_rejection"
          ? intEnv("LOAD_TARGET_RPS", PROFILE === "catalog" ? 20 : 5)
          : null,
      startRps: PROFILE === "catalog" ? intEnv("LOAD_START_RPS", 5) : null,
      vus: __ENV.LOAD_VUS || null,
      duration: __ENV.LOAD_DURATION || null,
      rampDuration: __ENV.LOAD_RAMP_DURATION || null,
      holdDuration: __ENV.LOAD_HOLD_DURATION || null,
      cooldownDuration: __ENV.LOAD_COOLDOWN_DURATION || null,
      preAllocatedVUs: __ENV.LOAD_PREALLOCATED_VUS || null,
      maxVUs: __ENV.LOAD_MAX_VUS || null,
    },
    metrics: data.metrics,
    rootGroup: data.root_group,
  };
  const path = __ENV.LOAD_SUMMARY_PATH || `k6-summary-${PROFILE}-${RUN_ID}.json`;
  return {
    stdout: summaryLine(data),
    [path]: JSON.stringify(output, null, 2),
  };
}

function assertProfileInputs() {
  if (PROFILE === "orders") {
    if (!ALLOW_WRITES) fail("orders profile requires ALLOW_WRITES=true");
    if (orderListingIds.length === 0) fail("orders profile requires ORDER_LISTING_IDS");
  }
  if (PROFILE === "payment_replay") {
    if (paymentOrderIds.length === 0) fail("payment_replay requires PAYMENT_ORDER_IDS");
  }
}

function requestParams(name, accessToken, extraHeaders = {}, expectedStatuses = [200]) {
  return {
    tags: { name },
    responseCallback: http.expectedStatuses(...expectedStatuses),
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...extraHeaders,
    },
  };
}

function csv(name) {
  return (__ENV[name] || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function requiredEnv(name) {
  const value = __ENV[name];
  if (!value) fail(`${name} is required for LOAD_PROFILE=${PROFILE}`);
  return value;
}

function intEnv(name, fallback) {
  const raw = __ENV[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function summaryLine(data) {
  const duration = data.metrics.http_req_duration?.values || {};
  const requests = data.metrics.http_reqs?.values || {};
  const failures = data.metrics.http_req_failed?.values || {};
  const dropped = data.metrics.dropped_iterations?.values || {};
  return [
    `profile=${PROFILE}`,
    `requests=${requests.count ?? 0}`,
    `rps=${format(requests.rate)}`,
    `p50_ms=${format(duration["p(50)"])}`,
    `p95_ms=${format(duration["p(95)"])}`,
    `p99_ms=${format(duration["p(99)"])}`,
    `http_failed_rate=${format(failures.rate)}`,
    `dropped_iterations=${dropped.count ?? 0}`,
    `summary=${__ENV.LOAD_SUMMARY_PATH || `k6-summary-${PROFILE}-${RUN_ID}.json`}`,
    "",
  ].join(" ");
}

function format(value) {
  return typeof value === "number" ? value.toFixed(2) : "n/a";
}
