import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { app } from "../app.js";
import { openApiSpec } from "../shared/docs/openapi.js";
import { API_V1_PREFIX } from "../shared/http/apiVersion.js";
import { SECURITY_HEADERS } from "../shared/middlewares/securityHeaders.js";

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

describe("API v1 versioning (SPEC-0007)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.RATE_LIMIT_API_MAX = "10000";
    process.env.RATE_LIMIT_AUTH_MAX = "10000";
    server = await listen();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  it("exports the /api/v1 prefix constant", () => {
    expect(API_V1_PREFIX).toBe("/api/v1");
  });

  it("keeps unversioned /auth/me as a v1 alias (401 without bearer)", async () => {
    const response = await fetch(`${baseUrl}/auth/me`);
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Missing or invalid authorization header" });
  });

  it("serves the same /auth/me contract on /api/v1", async () => {
    const [unversioned, versioned] = await Promise.all([
      fetch(`${baseUrl}/auth/me`),
      fetch(`${baseUrl}/api/v1/auth/me`),
    ]);
    expect(versioned.status).toBe(unversioned.status);
    expect(versioned.status).toBe(401);
    const unversionedBody = (await unversioned.json()) as { error: string };
    const versionedBody = (await versioned.json()) as { error: string };
    expect(versionedBody).toEqual(unversionedBody);
  });

  it("maps invalid JSON on /api/v1/auth/login the same as /auth/login", async () => {
    const headers = { "Content-Type": "application/json" };
    const [unversioned, versioned] = await Promise.all([
      fetch(`${baseUrl}/auth/login`, { method: "POST", headers, body: "{not-json" }),
      fetch(`${baseUrl}/api/v1/auth/login`, { method: "POST", headers, body: "{not-json" }),
    ]);
    expect(unversioned.status).toBe(400);
    expect(versioned.status).toBe(400);
    const unversionedBody = (await unversioned.json()) as { error: string };
    const versionedBody = (await versioned.json()) as { error: string };
    expect(unversionedBody).toEqual({ error: "Invalid JSON body." });
    expect(versionedBody).toEqual(unversionedBody);
    expect(JSON.stringify(versionedBody)).not.toContain("not-json");
  });

  it("keeps /health and /docs/json at the host root", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const docs = await fetch(`${baseUrl}/docs/json`);
    expect(docs.status).toBe(200);
    const spec = (await docs.json()) as { servers: Array<{ url: string }> };
    expect(spec.servers.some((server) => server.url.endsWith("/api/v1"))).toBe(true);
  });

  it("does not require /api/v1/health", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Route not found");
    expect(JSON.stringify(body)).not.toMatch(/stack|at\s+\w+\s+\(/i);
  });

  it("returns generic 404 for unknown version prefixes", async () => {
    const v2 = await fetch(`${baseUrl}/api/v2/listings`);
    const bare = await fetch(`${baseUrl}/api`);
    expect(v2.status).toBe(404);
    expect(bare.status).toBe(404);
    const v2Body = (await v2.json()) as { error: string };
    expect(v2Body.error).toBe("Route not found");
    expect(JSON.stringify(v2Body)).not.toMatch(/stack|internal/i);
  });

  it("applies security headers on /api/v1", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`);
    expect(response.status).toBe(401);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("rejects an unlisted Origin on /api/v1 without echoing it", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Origin: "https://attacker.example.com" },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Origin not allowed." });
    expect(JSON.stringify(body)).not.toContain("attacker.example.com");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("OpenAPI v1 servers (SPEC-0007)", () => {
  it("documents /api/v1 as the current public contract", () => {
    const urls = openApiSpec.servers.map((server) => server.url);
    expect(urls).toContain("http://localhost:3001/api/v1");
    expect(urls).toContain("https://api.neonarsenal.com/api/v1");
    expect(openApiSpec.info.description).toContain("/api/v1");
    expect(openApiSpec.info.description).toContain("docs/architecture/api-versioning.md");
  });

  it("keeps health and ready operations host-rooted", () => {
    const healthServers = openApiSpec.paths["/health"].get.servers?.map((server) => server.url) ?? [];
    const readyServers = openApiSpec.paths["/ready"].get.servers?.map((server) => server.url) ?? [];
    expect(healthServers).toContain("http://localhost:3001");
    expect(healthServers.every((url) => !url.endsWith("/api/v1"))).toBe(true);
    expect(readyServers).toContain("http://localhost:3001");
    expect(readyServers.every((url) => !url.endsWith("/api/v1"))).toBe(true);
  });
});
