import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { app } from "../app.js";
import { JSON_BODY_LIMIT_BYTES } from "../shared/config/http.js";
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

describe("API HTTP security edge", () => {
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

  it("sends security headers on public responses", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
    expect(response.headers.get("cross-origin-resource-policy")).toBeNull();
  });

  it("rejects an unlisted browser Origin without echoing it", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://attacker.example.com" },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Origin not allowed." });
    expect(JSON.stringify(body)).not.toContain("attacker.example.com");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects JSON larger than 100 KiB with a generic 413", async () => {
    const password = "a".repeat(JSON_BODY_LIMIT_BYTES);
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer@test.local", password }),
    });
    expect(response.status).toBe(413);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Request payload too large." });
  });

  it("rejects invalid JSON with a generic 400", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body).toEqual({ error: "Invalid JSON body." });
    expect(JSON.stringify(body)).not.toContain("not-json");
  });
});
