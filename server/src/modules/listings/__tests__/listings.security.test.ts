import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { listingsRoutes } from "../listings.routes.js";
import { errorHandler } from "../../../shared/errors/index.js";
import { updateListingDto } from "../listings.dto.js";
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

describe("listings HTTP security", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/listings", listingsRoutes);
    app.use(errorHandler);
    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  it("rejects anonymous POST /listings/:id/reserve", async () => {
    const response = await fetch(`${baseUrl}/listings/listing-1/reserve`, { method: "POST" });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("does not accept a client-supplied listing status on the update DTO", () => {
    expect(() => updateListingDto.parse({ tradeLockUntil: null, status: "SOLD" })).toThrow();
    expect(() => updateListingDto.parse({ tradeLockUntil: null, status: "RESERVED" })).toThrow();
    expect(updateListingDto.parse({ tradeLockUntil: null })).toEqual({ tradeLockUntil: null });
  });

  it("AUD-015: rejects a price field on the generic update DTO instead of silently stripping it", () => {
    expect(() => updateListingDto.parse({ price: 99 })).toThrow();
    expect(() => updateListingDto.parse({ tradeLockUntil: null, price: 99 })).toThrow();
  });

  it("still requires a seller or admin role to PATCH a listing", async () => {
    const token = signAccessToken({
      sub: "customer-1",
      email: "buyer@test.local",
      role: "CUSTOMER",
    });
    const response = await fetch(`${baseUrl}/listings/listing-1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tradeLockUntil: null, status: "SOLD" }),
    });
    expect(response.status).toBe(403);
  });

  it("AUD-015: rejects a generic PATCH /listings/:id carrying a price field with 400 for an authorized seller", async () => {
    const token = signAccessToken({
      sub: "seller-1",
      email: "seller@test.local",
      role: "SELLER",
    });
    const response = await fetch(`${baseUrl}/listings/listing-1`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ price: 10 }),
    });
    // The role gate passes for SELLER; body validation must still reject `price`
    // before the request can reach listingsService.update.
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/price/i);
  });
});
