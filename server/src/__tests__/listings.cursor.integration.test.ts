import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { errorHandler } from "../shared/errors/index.js";
import { listingsRoutes } from "../modules/listings/listings.routes.js";
import { productsRoutes } from "../modules/products/products.routes.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { productsService } from "../modules/products/products.service.js";
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

async function seedListings(count: number, start: Date) {
  const seller = await createSeller();
  const product = await createProduct();
  const listings = [];
  for (let index = 0; index < count; index += 1) {
    listings.push(
      await createListing({
        productId: product.id,
        sellerId: seller.id,
        createdAt: new Date(start.getTime() + index * 1000),
      })
    );
  }
  return { seller, product, listings };
}

describe("cursor pagination (postgres)", () => {
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

  it("returns nextCursor on the first keyset page and null on the last", async () => {
    const { listings } = await seedListings(5, new Date("2026-06-01T00:00:00.000Z"));
    const newestFirst = [...listings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const first = await listingsService.list({ cursor: "", page: 1, limit: 2 });
    expect("total" in first).toBe(false);
    expect("page" in first).toBe(false);
    expect(first.limit).toBe(2);
    expect(first.items.map((row) => row.id)).toEqual([newestFirst[0].id, newestFirst[1].id]);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await listingsService.list({
      cursor: first.nextCursor ?? "",
      page: 99,
      limit: 2,
    });
    expect(second.items.map((row) => row.id)).toEqual([newestFirst[2].id, newestFirst[3].id]);
    expect(second.nextCursor).toEqual(expect.any(String));

    const last = await listingsService.list({
      cursor: second.nextCursor ?? "",
      page: 1,
      limit: 2,
    });
    expect(last.items.map((row) => row.id)).toEqual([newestFirst[4].id]);
    expect(last.nextCursor).toBeNull();
  });

  it("does not duplicate or skip listings when a newer row is inserted after the first cursor page", async () => {
    const { product, seller, listings } = await seedListings(5, new Date("2026-07-01T00:00:00.000Z"));
    const newestFirst = [...listings].sort((a, b) => {
      const byTime = b.createdAt.getTime() - a.createdAt.getTime();
      if (byTime !== 0) return byTime;
      return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
    });

    const first = await listingsService.list({ cursor: "", page: 1, limit: 2 });
    const firstIds = first.items.map((row) => row.id);
    expect(firstIds).toEqual([newestFirst[0].id, newestFirst[1].id]);

    const inserted = await createListing({
      productId: product.id,
      sellerId: seller.id,
      createdAt: new Date("2026-07-01T00:00:10.000Z"),
    });

    const second = await listingsService.list({
      cursor: first.nextCursor ?? "",
      page: 1,
      limit: 2,
    });
    const secondIds = second.items.map((row) => row.id);

    expect(secondIds).not.toContain(inserted.id);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(4);
    expect(secondIds).toEqual([newestFirst[2].id, newestFirst[3].id]);

    const offsetAfterInsert = await listingsService.list({ page: 2, limit: 2 });
    expect(offsetAfterInsert.items.map((row) => row.id)).toContain(newestFirst[1].id);
  });

  it("keeps createdAt ties stable when a same-timestamp row is inserted with a greater id", async () => {
    const seller = await createSeller();
    const product = await createProduct();
    const createdAt = new Date("2026-08-01T00:00:00.000Z");
    await createListing({ id: "listing-tie-a", productId: product.id, sellerId: seller.id, createdAt });
    await createListing({ id: "listing-tie-b", productId: product.id, sellerId: seller.id, createdAt });
    await createListing({ id: "listing-tie-c", productId: product.id, sellerId: seller.id, createdAt });

    const first = await listingsService.list({ cursor: "", page: 1, limit: 1 });
    expect(first.items.map((row) => row.id)).toEqual(["listing-tie-c"]);

    await createListing({ id: "listing-tie-d", productId: product.id, sellerId: seller.id, createdAt });

    const second = await listingsService.list({
      cursor: first.nextCursor ?? "",
      page: 1,
      limit: 1,
    });
    expect(second.items.map((row) => row.id)).toEqual(["listing-tie-b"]);
    expect(second.items[0].id).not.toBe("listing-tie-d");
    expect(second.items[0].id).not.toBe("listing-tie-c");
  });

  it("keeps offset page/limit/total working for Market clients", async () => {
    await seedListings(5, new Date("2026-09-01T00:00:00.000Z"));
    const page1 = await listingsService.list({ page: 1, limit: 2 });
    expect(page1).toMatchObject({ total: 5, page: 1, limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toEqual(expect.any(String));

    const page3 = await listingsService.list({ page: 3, limit: 2 });
    expect(page3).toMatchObject({ total: 5, page: 3, limit: 2 });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();
  });

  it("returns HTTP 400 for an invalid cursor and 200 for public offset and cursor lists", async () => {
    await seedListings(3, new Date("2026-10-01T00:00:00.000Z"));

    const invalid = await fetch(`${baseUrl}/listings?cursor=not-a-cursor`);
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "Invalid cursor" });

    const offset = await fetch(`${baseUrl}/listings?page=1&limit=2`);
    expect(offset.status).toBe(200);
    const offsetBody = (await offset.json()) as {
      items: unknown[];
      total: number;
      page: number;
      limit: number;
      nextCursor: string | null;
    };
    expect(offsetBody).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(offsetBody.items).toHaveLength(2);
    expect(offsetBody.nextCursor).toEqual(expect.any(String));

    const cursor = await fetch(`${baseUrl}/listings?cursor=&limit=2`);
    expect(cursor.status).toBe(200);
    const cursorBody = (await cursor.json()) as {
      items: unknown[];
      limit: number;
      nextCursor: string | null;
      total?: number;
      page?: number;
    };
    expect(cursorBody.limit).toBe(2);
    expect(cursorBody.items).toHaveLength(2);
    expect(cursorBody.nextCursor).toEqual(expect.any(String));
    expect(cursorBody.total).toBeUndefined();
    expect(cursorBody.page).toBeUndefined();
  });

  it("paginates products by createdAt+id cursor without skipping a concurrent newer insert", async () => {
    const t0 = new Date("2026-05-01T00:00:00.000Z");
    const products = [];
    for (let index = 0; index < 4; index += 1) {
      products.push(await createProduct({ createdAt: new Date(t0.getTime() + index * 1000) }));
    }
    const newestFirst = [...products].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const first = await productsService.list({ cursor: "", page: 1, limit: 2 });
    expect(first.items.map((row) => row.id)).toEqual([newestFirst[0].id, newestFirst[1].id]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect("total" in first).toBe(false);

    const inserted = await createProduct({ createdAt: new Date("2026-05-01T00:00:10.000Z") });
    const second = await productsService.list({
      cursor: first.nextCursor ?? "",
      page: 1,
      limit: 2,
    });
    expect(second.items.map((row) => row.id)).toEqual([newestFirst[2].id, newestFirst[3].id]);
    expect(second.items.map((row) => row.id)).not.toContain(inserted.id);
    expect(second.nextCursor).toBeNull();

    const offset = await productsService.list({ page: 1, limit: 20 });
    expect(offset).toMatchObject({ total: 5, page: 1, limit: 20 });
    expect(offset.nextCursor).toBeNull();
  });
});
