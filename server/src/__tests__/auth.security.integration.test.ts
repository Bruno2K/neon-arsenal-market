import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { prisma } from "../shared/database/index.js";
import { app } from "../app.js";
import { hashPassword } from "../shared/utils/hash.js";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { uniqueSuffix } from "./helpers/index.js";

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

async function jsonRequest(
  baseUrl: string,
  path: string,
  body: unknown
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>,
    headers: response.headers,
  };
}

describe("auth security (postgres)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.RATE_LIMIT_AUTH_MAX = "10000";
    process.env.RATE_LIMIT_API_MAX = "10000";
    server = await listen();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  async function createLoginUser(password = "password123") {
    const email = `auth-${uniqueSuffix()}@test.local`;
    await prisma.user.create({
      data: {
        name: "Auth Test",
        email,
        password: await hashPassword(password),
        role: "CUSTOMER",
      },
    });
    return { email, password };
  }

  it(`${DomainInvariant.AUTH_REFRESH_FAMILY}: rotation succeeds and reuse revokes the family`, async () => {
    const creds = await createLoginUser();
    const login = await jsonRequest(baseUrl, "/auth/login", creds);
    expect(login.status).toBe(200);
    const firstRefresh = login.json.refreshToken as string;

    const rotated = await jsonRequest(baseUrl, "/auth/refresh", { refreshToken: firstRefresh });
    expect(rotated.status).toBe(200);
    const secondRefresh = rotated.json.refreshToken as string;
    expect(secondRefresh).not.toBe(firstRefresh);

    const reuse = await jsonRequest(baseUrl, "/auth/refresh", { refreshToken: firstRefresh });
    expect(reuse.status).toBe(401);
    expect(reuse.json.error).toBe("Refresh token reuse detected. Please log in again.");

    const successorDead = await jsonRequest(baseUrl, "/auth/refresh", { refreshToken: secondRefresh });
    expect(successorDead.status).toBe(401);

    const decoded = jwt.decode(firstRefresh) as { familyId: string };
    const family = await prisma.refreshToken.findMany({ where: { familyId: decoded.familyId } });
    expect(family.length).toBeGreaterThanOrEqual(2);
    expect(family.every((row) => row.revokedAt != null || row.usedAt != null)).toBe(true);
    expect(family.every((row) => !("token" in row))).toBe(true);
  });

  it("treats concurrent refresh of the same token as reuse and leaves no live family token", async () => {
    const creds = await createLoginUser();
    const login = await jsonRequest(baseUrl, "/auth/login", creds);
    const refreshToken = login.json.refreshToken as string;

    const [a, b] = await Promise.all([
      jsonRequest(baseUrl, "/auth/refresh", { refreshToken }),
      jsonRequest(baseUrl, "/auth/refresh", { refreshToken }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toContain(200);
    expect(statuses).toContain(401);

    const winner = a.status === 200 ? a : b;
    const followUp = await jsonRequest(baseUrl, "/auth/refresh", {
      refreshToken: winner.json.refreshToken,
    });
    expect(followUp.status).toBe(401);
  });

  it("logout revokes the family so a later refresh fails", async () => {
    const creds = await createLoginUser();
    const login = await jsonRequest(baseUrl, "/auth/login", creds);
    const refreshToken = login.json.refreshToken as string;
    const logout = await jsonRequest(baseUrl, "/auth/logout", { refreshToken });
    expect(logout.status).toBe(200);
    const again = await jsonRequest(baseUrl, "/auth/refresh", { refreshToken });
    expect(again.status).toBe(401);
  });

  it("rejects expired refresh rows even if the JWT still verifies", async () => {
    const creds = await createLoginUser();
    const login = await jsonRequest(baseUrl, "/auth/login", creds);
    const refreshToken = login.json.refreshToken as string;
    const decoded = jwt.decode(refreshToken) as { jti: string };
    await prisma.refreshToken.update({
      where: { jti: decoded.jti },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await jsonRequest(baseUrl, "/auth/refresh", { refreshToken });
    expect(expired.status).toBe(401);
    expect(expired.json.error).toBe("Invalid or expired refresh token");
  });

  it("applies progressive delay then 429 with Retry-After after failed logins", async () => {
    const creds = await createLoginUser();
    for (let i = 0; i < 3; i += 1) {
      const failed = await jsonRequest(baseUrl, "/auth/login", {
        email: creds.email,
        password: "wrong-pass-1",
      });
      expect(failed.status).toBe(401);
    }
    const blocked = await jsonRequest(baseUrl, "/auth/login", {
      email: creds.email,
      password: "wrong-pass-1",
    });
    expect(blocked.status).toBe(429);
    expect(blocked.json.error).toBe("Too many login attempts. Try again later.");
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);

    const throttle = await prisma.loginThrottle.findUnique({
      where: { emailNormalized: creds.email },
    });
    expect(throttle?.failedCount).toBe(3);
    expect(throttle?.nextAllowedAt).not.toBeNull();
  });

  it("throttles unknown emails the same way so existence is not leaked by 429 vs 401", async () => {
    const email = `missing-${uniqueSuffix()}@test.local`;
    for (let i = 0; i < 3; i += 1) {
      const failed = await jsonRequest(baseUrl, "/auth/login", { email, password: "wrong-pass-1" });
      expect(failed.status).toBe(401);
      expect(failed.json.error).toBe("Invalid email or password");
    }
    const blocked = await jsonRequest(baseUrl, "/auth/login", { email, password: "wrong-pass-1" });
    expect(blocked.status).toBe(429);
  });

  it("rejects registration passwords that miss the policy", async () => {
    const weak = await jsonRequest(baseUrl, "/auth/register", {
      name: "Weak",
      email: `weak-${uniqueSuffix()}@test.local`,
      password: "short1",
      role: "CUSTOMER",
    });
    expect(weak.status).toBe(400);
    expect(String(weak.json.error)).toMatch(/at least 8 characters/i);

    const letters = await jsonRequest(baseUrl, "/auth/register", {
      name: "Weak",
      email: `letters-${uniqueSuffix()}@test.local`,
      password: "abcdefgh",
      role: "CUSTOMER",
    });
    expect(letters.status).toBe(400);
    expect(String(letters.json.error)).toMatch(/number/i);
  });
});
