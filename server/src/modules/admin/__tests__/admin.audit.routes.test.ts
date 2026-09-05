import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { adminRoutes } from "../admin.routes.js";
import { errorHandler } from "../../../shared/errors/index.js";
import { signAccessToken } from "../../../shared/utils/jwt.js";

function listen(app: express.Express) {
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe("GET /admin/audit-logs authorization", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/admin", adminRoutes);
    app.use(errorHandler);
    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  it("returns 401 without a bearer token", async () => {
    const response = await fetch(`${baseUrl}/admin/audit-logs`);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 for CUSTOMER", async () => {
    const token = signAccessToken({
      sub: "customer-1",
      email: "buyer@test.local",
      role: "CUSTOMER",
    });
    const response = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
  });

  it("returns 403 for SELLER", async () => {
    const token = signAccessToken({
      sub: "seller-1",
      email: "seller@test.local",
      role: "SELLER",
    });
    const response = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
  });
});
