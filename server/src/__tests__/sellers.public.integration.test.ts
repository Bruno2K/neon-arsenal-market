import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { prisma } from "../shared/database/index.js";
import { signAccessToken } from "../shared/utils/jwt.js";
import { errorHandler } from "../shared/errors/index.js";
import { sellersRoutes } from "../modules/sellers/sellers.routes.js";
import { adminRoutes } from "../modules/admin/admin.routes.js";
import { createCheckoutGraph, createUser } from "./helpers/index.js";

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

/**
 * AUD-005 / AUD-008 (PR11): public seller surface must be approved-only with a
 * narrow projection, commissionRate must never be caller-controlled, and the new
 * ADMIN-only GET /admin/sellers must still see everything for management.
 */
describe("public seller surface & commission rate (postgres)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/sellers", sellersRoutes);
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

  it("GET /sellers only returns approved sellers with the narrow public projection", async () => {
    const approved = await createCheckoutGraph();
    const pendingUser = await createUser({ name: "Pending Seller", role: "SELLER" });
    await prisma.seller.create({
      data: { userId: pendingUser.id, storeName: "Pending Store", isApproved: false },
    });

    const response = await fetch(`${baseUrl}/sellers`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<Record<string, unknown>>;

    expect(body.some((s) => s.id === approved.seller.id)).toBe(true);
    expect(body.some((s) => s.storeName === "Pending Store")).toBe(false);

    for (const entry of body) {
      expect(Object.keys(entry).sort()).toEqual(["id", "rating", "storeName", "user"]);
      if (entry.user) {
        expect(Object.keys(entry.user as object).sort()).toEqual(["id", "name"]);
      }
    }
    expect(JSON.stringify(body)).not.toMatch(/email|balance|commissionRate|isApproved/i);
  });

  it("GET /sellers/:id returns the narrow projection for an approved seller", async () => {
    const fixture = await createCheckoutGraph();

    const response = await fetch(`${baseUrl}/sellers/${fixture.seller.id}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toEqual({
      id: fixture.seller.id,
      storeName: fixture.seller.storeName,
      rating: 0,
      user: { id: fixture.sellerUser.id, name: fixture.sellerUser.name },
    });
  });

  it("GET /sellers/:id 404s for a pending seller instead of leaking it", async () => {
    const pendingUser = await createUser({ name: "Pending Seller 2", role: "SELLER" });
    const pending = await prisma.seller.create({
      data: { userId: pendingUser.id, storeName: "Pending Store 2", isApproved: false },
    });

    const response = await fetch(`${baseUrl}/sellers/${pending.id}`);
    expect(response.status).toBe(404);
  });

  it("AUD-005: POST /sellers/apply ignores a caller-supplied commissionRate; new sellers get the DB default 0.1", async () => {
    const customer = await createUser({ name: "Applicant", role: "CUSTOMER" });
    const token = signAccessToken({ sub: customer.id, email: customer.email, role: "CUSTOMER" });

    const response = await fetch(`${baseUrl}/sellers/apply`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: "New Store", commissionRate: 0 }),
    });

    expect(response.status).toBe(201);
    const created = await prisma.seller.findUnique({ where: { userId: customer.id } });
    expect(created?.commissionRate.toString()).toBe("0.1");
  });

  it("AUD-005: PATCH /sellers/:id ignores a caller-supplied commissionRate for the owning seller", async () => {
    const fixture = await createCheckoutGraph();
    const token = signAccessToken({
      sub: fixture.sellerUser.id,
      email: fixture.sellerUser.email,
      role: "SELLER",
    });

    const response = await fetch(`${baseUrl}/sellers/${fixture.seller.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ storeName: "Renamed Store", commissionRate: 0.5 }),
    });

    expect(response.status).toBe(200);
    const updated = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });
    expect(updated?.storeName).toBe("Renamed Store");
    expect(updated?.commissionRate.toString()).toBe("0.1");
  });

  it("GET /admin/sellers requires ADMIN and returns full rows including pending sellers", async () => {
    const approved = await createCheckoutGraph();
    const pendingUser = await createUser({ name: "Pending Seller 3", role: "SELLER" });
    await prisma.seller.create({
      data: { userId: pendingUser.id, storeName: "Pending Store 3", isApproved: false },
    });
    const admin = await createUser({ name: "Admin", role: "ADMIN" });
    const adminToken = signAccessToken({ sub: admin.id, email: admin.email, role: "ADMIN" });

    const asAdmin = await fetch(`${baseUrl}/admin/sellers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(asAdmin.status).toBe(200);
    const body = (await asAdmin.json()) as Array<Record<string, unknown>>;
    expect(body.some((s) => s.id === approved.seller.id)).toBe(true);
    expect(body.some((s) => s.storeName === "Pending Store 3")).toBe(true);
    expect(body.some((s) => "commissionRate" in s)).toBe(true);

    const sellerToken = signAccessToken({
      sub: approved.sellerUser.id,
      email: approved.sellerUser.email,
      role: "SELLER",
    });
    const asSeller = await fetch(`${baseUrl}/admin/sellers`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(asSeller.status).toBe(403);

    const anonymous = await fetch(`${baseUrl}/admin/sellers`);
    expect(anonymous.status).toBe(401);
  });
});
