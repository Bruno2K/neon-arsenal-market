import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { favoritesRoutes } from "../favorites.routes.js";
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

function bearer(role: "CUSTOMER" | "SELLER" | "ADMIN") {
  return `Bearer ${signAccessToken({
    sub: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@test.local`,
    role,
  })}`;
}

describe("favorites HTTP auth (#106)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/favorites", favoritesRoutes);
    app.use(errorHandler);
    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  it("returns 401 for anonymous GET/POST/DELETE", async () => {
    const get = await fetch(`${baseUrl}/favorites`);
    const post = await fetch(`${baseUrl}/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: "listing-1" }),
    });
    const del = await fetch(`${baseUrl}/favorites/listing-1`, { method: "DELETE" });
    expect(get.status).toBe(401);
    expect(post.status).toBe(401);
    expect(del.status).toBe(401);
  });

  it("returns 403 for SELLER and ADMIN", async () => {
    for (const role of ["SELLER", "ADMIN"] as const) {
      const response = await fetch(`${baseUrl}/favorites`, {
        headers: { Authorization: bearer(role) },
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: "Insufficient permissions" });
    }
  });

  it("returns 400 for invalid listingId on POST", async () => {
    const response = await fetch(`${baseUrl}/favorites`, {
      method: "POST",
      headers: {
        Authorization: bearer("CUSTOMER"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ listingId: "" }),
    });
    expect(response.status).toBe(400);
  });
});
