import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { listingsRoutes } from "../listings.routes.js";
import { productsRoutes } from "../../products/products.routes.js";
import { errorHandler } from "../../../shared/errors/index.js";
import { listListingsQueryDto } from "../listings.dto.js";
import { listProductsQueryDto } from "../../products/products.dto.js";

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

describe("GET /listings and GET /products pagination query contract", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use("/listings", listingsRoutes);
    app.use("/products", productsRoutes);
    app.use(errorHandler);
    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  it("defaults page/limit and accepts an optional cursor on listings and products", () => {
    expect(listListingsQueryDto.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(listListingsQueryDto.parse({ limit: "100" })).toMatchObject({ page: 1, limit: 100 });
    expect(listListingsQueryDto.safeParse({ limit: "101" }).success).toBe(false);
    expect(listListingsQueryDto.parse({ cursor: "", page: "9" })).toMatchObject({
      cursor: "",
      page: 9,
      limit: 20,
    });
    expect(listListingsQueryDto.parse({ sort: "price_asc", weapon: "AK-47" })).toMatchObject({
      sort: "price_asc",
      weapon: "AK-47",
    });
    expect(listListingsQueryDto.safeParse({ sort: "newest" }).success).toBe(false);
    expect(listProductsQueryDto.parse({ cursor: "abc" })).toMatchObject({ cursor: "abc", page: 1, limit: 20 });
  });

  it("returns 400 for an invalid listings cursor without requiring auth", async () => {
    const response = await fetch(`${baseUrl}/listings?cursor=not-a-cursor&limit=2`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid cursor" });
  });

  it("returns 400 for an unknown listings sort key", async () => {
    const response = await fetch(`${baseUrl}/listings?sort=newest`);
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid products cursor without requiring auth", async () => {
    const response = await fetch(`${baseUrl}/products?cursor=not-a-cursor&limit=2`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid cursor" });
  });
});
