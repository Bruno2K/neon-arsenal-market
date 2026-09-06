import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { errorHandler } from "../shared/errors/index.js";
import { listingsRoutes } from "../modules/listings/listings.routes.js";
import { listingsRepository } from "../modules/listings/listings.repository.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { LISTING_SORTS, listingOrderBy } from "../modules/listings/listings.sort.js";
import { createListing, createProduct, createSeller } from "./helpers/index.js";

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

async function seedPricedListings() {
  const seller = await createSeller();
  const product = await createProduct();
  const cheap = await createListing({
    id: "listing-cheap",
    productId: product.id,
    sellerId: seller.id,
    price: "10.00",
    floatValue: "0.40",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  const mid = await createListing({
    id: "listing-mid",
    productId: product.id,
    sellerId: seller.id,
    price: "20.00",
    floatValue: "0.20",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
  });
  const expensive = await createListing({
    id: "listing-expensive",
    productId: product.id,
    sellerId: seller.id,
    price: "50.00",
    floatValue: "0.05",
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
  });
  return { cheap, mid, expensive };
}

describe("GET /listings sort (postgres, #93)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
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

  it("repository applies each whitelist orderBy to the full catalog", async () => {
    const { cheap, mid, expensive } = await seedPricedListings();
    const expected: Record<(typeof LISTING_SORTS)[number], string[]> = {
      createdAt_desc: [expensive.id, mid.id, cheap.id],
      price_asc: [cheap.id, mid.id, expensive.id],
      price_desc: [expensive.id, mid.id, cheap.id],
      float_asc: [expensive.id, mid.id, cheap.id],
      float_desc: [cheap.id, mid.id, expensive.id],
    };

    for (const sort of LISTING_SORTS) {
      const { items } = await listingsRepository.findMany({
        skip: 0,
        take: 10,
        orderBy: listingOrderBy(sort),
      });
      expect(items.map((row) => row.id), sort).toEqual(expected[sort]);
    }
  });

  it("service.list price_asc puts the cheapest listing on page 1 when it would be on page 2 by createdAt", async () => {
    const { cheap, expensive } = await seedPricedListings();

    const newestFirst = await listingsService.list({ page: 1, limit: 1, sort: "createdAt_desc" });
    expect(newestFirst.items.map((row) => row.id)).toEqual([expensive.id]);

    const cheapestFirst = await listingsService.list({ page: 1, limit: 1, sort: "price_asc" });
    expect(cheapestFirst.items.map((row) => row.id)).toEqual([cheap.id]);

    const page2 = await listingsService.list({ page: 2, limit: 1, sort: "price_asc" });
    expect(page2.items[0]?.id).not.toBe(cheap.id);
  });

  it("HTTP offset sort=price_asc returns the cheapest ACTIVE listing on page 1", async () => {
    const { cheap } = await seedPricedListings();
    const response = await fetch(`${baseUrl}/listings?sort=price_asc&page=1&limit=1`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: Array<{ id: string }> };
    expect(body.items.map((row) => row.id)).toEqual([cheap.id]);
  });
});
