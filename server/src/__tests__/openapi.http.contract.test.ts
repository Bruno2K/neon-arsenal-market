import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { listingsRepository } from "../modules/listings/listings.repository.js";
import { productsRepository } from "../modules/products/products.repository.js";
import { app } from "../app.js";
import { openApiSpec } from "../shared/docs/openapi.js";
import {
  assertErrorBody,
  assertMatchesSchema,
  type JsonSchema,
} from "../shared/docs/openapiAssert.js";
import { API_V1_PREFIX } from "../shared/http/apiVersion.js";
import { SECURITY_HEADERS } from "../shared/middlewares/securityHeaders.js";
import { signAccessToken } from "../shared/utils/jwt.js";

vi.mock("../modules/listings/listings.repository.js", () => ({
  listingsRepository: {
    findMany: vi.fn(),
    findManyByKeyset: vi.fn(),
  },
}));

vi.mock("../modules/products/products.repository.js", () => ({
  productsRepository: {
    findMany: vi.fn(),
    findManyByKeyset: vi.fn(),
  },
}));

const spec = openApiSpec as unknown as {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, JsonSchema> };
};

function listen() {
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function operation(path: string, method: string): {
  responses: Record<string, unknown>;
  security?: unknown[];
  parameters?: Array<{ name: string; in: string; required?: boolean }>;
} {
  const item = spec.paths[path];
  if (!item) throw new Error(`OpenAPI is missing path ${path}`);
  const op = item[method] as
    | {
        responses: Record<string, unknown>;
        security?: unknown[];
        parameters?: Array<{ name: string; in: string; required?: boolean }>;
      }
    | undefined;
  if (!op) throw new Error(`OpenAPI is missing ${method.toUpperCase()} ${path}`);
  return op;
}

function documentedStatuses(path: string, method: string): number[] {
  return Object.keys(operation(path, method).responses).map((code) => Number(code));
}

function responseSchema(path: string, method: string, status: number): JsonSchema | undefined {
  const responses = operation(path, method).responses as Record<
    string,
    { content?: { "application/json"?: { schema?: JsonSchema } } }
  >;
  return responses[String(status)]?.content?.["application/json"]?.schema;
}

async function jsonOf(response: Response): Promise<unknown> {
  return response.json();
}

describe("OpenAPI document (single spec)", () => {
  it("is OpenAPI 3.0.x with the documented Error and pagination schemas", () => {
    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.info.title).toBe("Neon Arsenal Market API");
    expect(spec.components.schemas.Error).toBeDefined();
    expect(spec.components.schemas.OffsetPage.required).toEqual(["items", "total", "page", "limit"]);
    expect(spec.components.schemas.CursorPage.required).toEqual(["items", "limit", "nextCursor"]);
  });

  it("documents every implemented public operation used by contract tests", () => {
    const required = [
      "/health",
      "/ready",
      "/auth/login",
      "/auth/me",
      "/listings",
      "/products",
      "/orders",
      "/payments/webhook",
      "/admin/audit-logs",
    ];
    for (const path of required) {
      expect(spec.paths[path], path).toBeDefined();
    }
  });

  it("documents Idempotency-Key on POST /orders and PayPal webhook headers", () => {
    const orderParams = operation("/orders", "post").parameters ?? [];
    expect(orderParams.some((param) => param.name === "Idempotency-Key" && param.in === "header" && param.required)).toBe(
      true
    );

    const webhookParams = operation("/payments/webhook", "post").parameters ?? [];
    for (const name of [
      "paypal-transmission-id",
      "paypal-transmission-time",
      "paypal-transmission-sig",
      "paypal-cert-url",
      "paypal-auth-algo",
    ]) {
      expect(webhookParams.some((param) => param.name === name && param.in === "header" && param.required)).toBe(true);
    }
  });

  it("documents login 429 with Retry-After and GET /listings pagination oneOf", () => {
    expect(documentedStatuses("/auth/login", "post")).toContain(429);
    const login429 = operation("/auth/login", "post").responses[429] as { description: string };
    expect(login429.description).toMatch(/Retry-After/);

    const listing200 = responseSchema("/listings", "get", 200);
    expect(listing200?.oneOf).toHaveLength(2);
  });
});

describe("HTTP handlers vs OpenAPI", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await listen();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  beforeEach(() => {
    vi.mocked(listingsRepository.findMany).mockReset();
    vi.mocked(listingsRepository.findManyByKeyset).mockReset();
    vi.mocked(productsRepository.findMany).mockReset();
    vi.mocked(productsRepository.findManyByKeyset).mockReset();
    vi.mocked(listingsRepository.findMany).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(listingsRepository.findManyByKeyset).mockResolvedValue({ items: [], hasMore: false });
    vi.mocked(productsRepository.findMany).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(productsRepository.findManyByKeyset).mockResolvedValue({ items: [], hasMore: false });
  });

  it("serves GET /docs/json as the same in-repo OpenAPI document", async () => {
    const response = await fetch(`${baseUrl}/docs/json`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await jsonOf(response)) as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe(openApiSpec.openapi);
    expect(Object.keys(body.paths)).toEqual(Object.keys(openApiSpec.paths));
  });

  it("GET /health matches the documented 200 schema and sets correlation + rate-limit headers", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { "X-Request-Id": "contract-health-1" },
    });
    expect(response.status).toBe(200);
    expect(documentedStatuses("/health", "get")).toContain(200);
    const body = await jsonOf(response);
    const schema = responseSchema("/health", "get", 200);
    if (schema) assertMatchesSchema(body, schema, spec, "health");
    expect(body).toEqual({ status: "ok" });
    expect(response.headers.get("x-request-id")).toBe("contract-health-1");
    expect(response.headers.get("ratelimit-limit") ?? response.headers.get("ratelimit")).toBeTruthy();
    expect(response.headers.get("x-content-type-options")).toBe(SECURITY_HEADERS["X-Content-Type-Options"]);
  });

  it("GET /ready returns a documented operational status without using /api/v1", async () => {
    const response = await fetch(`${baseUrl}/ready`);
    expect(documentedStatuses("/ready", "get")).toContain(response.status);
    expect([200, 503]).toContain(response.status);
    const body = (await jsonOf(response)) as { status: string };
    if (response.status === 200) {
      expect(body).toEqual({ status: "ready" });
    } else {
      expect(["unavailable", "shutting_down"]).toContain(body.status);
    }
    const versioned = await fetch(`${baseUrl}${API_V1_PREFIX}/ready`);
    expect(versioned.status).toBe(404);
    const missing = await jsonOf(versioned);
    assertErrorBody(missing, spec);
  });

  it("returns the documented Error shape for unknown routes", async () => {
    const response = await fetch(`${baseUrl}${API_V1_PREFIX}/this-route-does-not-exist`);
    expect(response.status).toBe(404);
    const body = await jsonOf(response);
    assertErrorBody(body, spec);
    expect(body).toEqual({ error: "Route not found" });
  });

  it("GET /api/v1/auth/me without bearer is 401 Error", async () => {
    const response = await fetch(`${baseUrl}${API_V1_PREFIX}/auth/me`);
    expect(response.status).toBe(401);
    expect(documentedStatuses("/auth/me", "get")).toContain(401);
    const body = await jsonOf(response);
    assertErrorBody(body, spec);
    expect(body).toEqual({ error: "Missing or invalid authorization header" });
  });

  it("rejects invalid login requests with 400 Error (request contract)", async () => {
    const response = await fetch(`${baseUrl}${API_V1_PREFIX}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "" }),
    });
    expect(response.status).toBe(400);
    const body = await jsonOf(response);
    assertErrorBody(body, spec);
    expect((body as { error: string }).error.length).toBeGreaterThan(0);
  });

  it("POST /api/v1/orders without auth is 401 Error", async () => {
    const response = await fetch(`${baseUrl}${API_V1_PREFIX}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ listingId: "listing-1" }] }),
    });
    expect(response.status).toBe(401);
    const body = await jsonOf(response);
    assertErrorBody(body, spec);
  });

  it("POST /api/v1/orders requires the documented Idempotency-Key header", async () => {
    const token = signAccessToken({
      sub: "customer-contract",
      email: "customer@example.com",
      role: "CUSTOMER",
    });
    const response = await fetch(`${baseUrl}${API_V1_PREFIX}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: [{ listingId: "listing-1" }] }),
    });
    expect(response.status).toBe(400);
    expect(documentedStatuses("/orders", "post")).toContain(400);
    const body = await jsonOf(response);
    assertErrorBody(body, spec);
    expect(body).toEqual({ error: "Idempotency-Key header is required" });
  });

  it("rejects an overlong Idempotency-Key with 400", async () => {
    const token = signAccessToken({
      sub: "customer-contract",
      email: "customer@example.com",
      role: "CUSTOMER",
    });
    const response = await fetch(`${baseUrl}${API_V1_PREFIX}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": "k".repeat(129),
      },
      body: JSON.stringify({ items: [{ listingId: "listing-1" }] }),
    });
    expect(response.status).toBe(400);
    const body = await jsonOf(response);
    assertErrorBody(body, spec);
    expect((body as { error: string }).error).toMatch(/Idempotency-Key/);
  });

  it("GET /api/v1/admin/audit-logs is 401 without a token and 403 for CUSTOMER", async () => {
    const missing = await fetch(`${baseUrl}${API_V1_PREFIX}/admin/audit-logs`);
    expect(missing.status).toBe(401);
    expect(documentedStatuses("/admin/audit-logs", "get")).toContain(401);
    assertErrorBody(await jsonOf(missing), spec);

    const token = signAccessToken({
      sub: "customer-contract",
      email: "customer@example.com",
      role: "CUSTOMER",
    });
    const forbidden = await fetch(`${baseUrl}${API_V1_PREFIX}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(forbidden.status).toBe(403);
    expect(documentedStatuses("/admin/audit-logs", "get")).toContain(403);
    const body = await jsonOf(forbidden);
    assertErrorBody(body, spec);
    expect(body).toEqual({ error: "Insufficient permissions" });
  });

  it("POST /payments/webhook without PayPal headers is 401 Error on both mounts", async () => {
    for (const path of ["/payments/webhook", `${API_V1_PREFIX}/payments/webhook`]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED" }),
      });
      expect(response.status, path).toBe(401);
      expect(documentedStatuses("/payments/webhook", "post")).toContain(401);
      const body = await jsonOf(response);
      assertErrorBody(body, spec);
      expect(body).toEqual({ error: "Invalid webhook signature" });
    }
  });

  it("GET /api/v1/listings offset and cursor pages match OffsetPage / CursorPage", async () => {
    const offset = await fetch(`${baseUrl}${API_V1_PREFIX}/listings?page=1&limit=20`);
    expect(offset.status).toBe(200);
    expect(documentedStatuses("/listings", "get")).toContain(200);
    const offsetBody = await jsonOf(offset);
    assertMatchesSchema(offsetBody, spec.components.schemas.OffsetPage, spec, "listings.offset");
    expect(offsetBody).toMatchObject({ items: [], total: 0, page: 1, limit: 20, nextCursor: null });

    const cursor = await fetch(`${baseUrl}${API_V1_PREFIX}/listings?cursor=&limit=20`);
    expect(cursor.status).toBe(200);
    const cursorBody = (await jsonOf(cursor)) as Record<string, unknown>;
    assertMatchesSchema(cursorBody, spec.components.schemas.CursorPage, spec, "listings.cursor");
    expect(cursorBody).toMatchObject({ items: [], limit: 20, nextCursor: null });
    expect(cursorBody.total).toBeUndefined();
    expect(cursorBody.page).toBeUndefined();
  });

  it("GET /api/v1/products uses the same dual pagination contract", async () => {
    const offset = await fetch(`${baseUrl}${API_V1_PREFIX}/products?page=1&limit=20`);
    expect(offset.status).toBe(200);
    const offsetBody = await jsonOf(offset);
    assertMatchesSchema(offsetBody, spec.components.schemas.OffsetPage, spec, "products.offset");

    const cursor = await fetch(`${baseUrl}${API_V1_PREFIX}/products?cursor=`);
    expect(cursor.status).toBe(200);
    const cursorBody = (await jsonOf(cursor)) as Record<string, unknown>;
    assertMatchesSchema(cursorBody, spec.components.schemas.CursorPage, spec, "products.cursor");
    expect(cursorBody.total).toBeUndefined();
  });

  it("returns 400 Error for invalid listing/product cursors and over-limit pages", async () => {
    const invalidListing = await fetch(`${baseUrl}${API_V1_PREFIX}/listings?cursor=not-a-cursor`);
    expect(invalidListing.status).toBe(400);
    expect(documentedStatuses("/listings", "get")).toContain(400);
    const listingBody = await jsonOf(invalidListing);
    assertErrorBody(listingBody, spec);
    expect(listingBody).toEqual({ error: "Invalid cursor" });

    const invalidProduct = await fetch(`${baseUrl}${API_V1_PREFIX}/products?cursor=not-a-cursor`);
    expect(invalidProduct.status).toBe(400);
    assertErrorBody(await jsonOf(invalidProduct), spec);

    const overLimit = await fetch(`${baseUrl}${API_V1_PREFIX}/listings?limit=101`);
    expect(overLimit.status).toBe(400);
    assertErrorBody(await jsonOf(overLimit), spec);
  });

  it("keeps unversioned /listings as a v1 compatibility alias of the same pagination contract", async () => {
    const [versioned, alias] = await Promise.all([
      fetch(`${baseUrl}${API_V1_PREFIX}/listings?page=1&limit=10`),
      fetch(`${baseUrl}/listings?page=1&limit=10`),
    ]);
    expect(versioned.status).toBe(200);
    expect(alias.status).toBe(200);
    const versionedBody = await jsonOf(versioned);
    const aliasBody = await jsonOf(alias);
    expect(aliasBody).toEqual(versionedBody);
    assertMatchesSchema(aliasBody, spec.components.schemas.OffsetPage, spec, "listings.alias");
  });
});
