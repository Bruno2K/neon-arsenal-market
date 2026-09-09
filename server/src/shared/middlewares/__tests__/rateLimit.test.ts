import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createRateLimiter, rateLimitClientKey } from "../rateLimit.js";

const originalRender = process.env.RENDER;

async function startLimiter() {
  const testApp = express();
  testApp.set("trust proxy", false);
  testApp.use(createRateLimiter(1));
  testApp.get("/", (_req, res) => res.sendStatus(204));
  const server = await new Promise<Server>((resolve) => {
    const listening = testApp.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server has no port");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  if (originalRender === undefined) delete process.env.RENDER;
  else process.env.RENDER = originalRender;
});

describe("rate-limit client identity", () => {
  it("does not let forged X-Forwarded-For values rotate a Render bucket", async () => {
    process.env.RENDER = "true";
    const { server, url } = await startLimiter();
    try {
      const first = await fetch(url, {
        headers: { "CF-Connecting-IP": "198.51.100.10", "X-Forwarded-For": "203.0.113.1" },
      });
      const second = await fetch(url, {
        headers: { "CF-Connecting-IP": "198.51.100.10", "X-Forwarded-For": "203.0.113.2" },
      });
      expect(first.status).toBe(204);
      expect(second.status).toBe(429);
    } finally {
      await close(server);
    }
  });

  it("keeps distinct valid Render clients in distinct buckets", async () => {
    process.env.RENDER = "true";
    const { server, url } = await startLimiter();
    try {
      const first = await fetch(url, { headers: { "CF-Connecting-IP": "198.51.100.10" } });
      const second = await fetch(url, { headers: { "CF-Connecting-IP": "198.51.100.11" } });
      expect(first.status).toBe(204);
      expect(second.status).toBe(204);
    } finally {
      await close(server);
    }
  });

  it("groups rotating IPv6 addresses from the same /56", () => {
    process.env.RENDER = "true";
    const makeRequest = (ip: string) =>
      ({
        socket: { remoteAddress: "10.0.0.4" },
        get: (name: string) => (name.toLowerCase() === "cf-connecting-ip" ? ip : undefined),
      }) as express.Request;

    expect(rateLimitClientKey(makeRequest("2001:db8:abcd:1200::1"))).toBe(
      rateLimitClientKey(makeRequest("2001:db8:abcd:12ff::99"))
    );
  });
});
