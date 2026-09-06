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

  it("does not apply a client-supplied listing status on the update DTO", () => {
    expect(updateListingDto.parse({ price: 99, status: "SOLD" })).toEqual({ price: 99 });
    expect(updateListingDto.parse({ price: 99, status: "RESERVED" })).toEqual({ price: 99 });
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
      body: JSON.stringify({ price: 10, status: "SOLD" }),
    });
    expect(response.status).toBe(403);
  });
});
