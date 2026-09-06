import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { errorHandler } from "../shared/errors/index.js";
import { listingsRoutes } from "../modules/listings/listings.routes.js";
import { listingsRepository } from "../modules/listings/listings.repository.js";
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

describe("GET /listings weapon/rarity filters (postgres, #103)", () => {
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

  it("GET /listings?weapon=AK-47 returns only AK-47 listings", async () => {
    const seller = await createSeller();
    const ak = await createProduct({ weapon: "AK-47", rarity: "Classified" });
    const awp = await createProduct({ weapon: "AWP", rarity: "Covert" });
    const akListing = await createListing({ productId: ak.id, sellerId: seller.id, price: "18.00" });
    await createListing({ productId: awp.id, sellerId: seller.id, price: "110.00" });

    const response = await fetch(`${baseUrl}/listings?weapon=AK-47`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: Array<{ id: string; product: { weapon: string } }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(akListing.id);
    expect(body.items[0]?.product.weapon).toBe("AK-47");
  });

  it("repository filters Product.rarity and Product.game", async () => {
    const seller = await createSeller();
    const covert = await createProduct({ weapon: "AWP", rarity: "Covert", game: "CS2" });
    const classified = await createProduct({ weapon: "AK-47", rarity: "Classified", game: "CS2" });
    const csgo = await createProduct({ weapon: "AWP", rarity: "Covert", game: "CSGO" });
    const covertListing = await createListing({ productId: covert.id, sellerId: seller.id });
    await createListing({ productId: classified.id, sellerId: seller.id });
    await createListing({ productId: csgo.id, sellerId: seller.id });

    const byRarity = await listingsRepository.findMany({
      skip: 0,
      take: 20,
      where: { product: { rarity: { equals: "Covert", mode: "insensitive" } } },
    });
    expect(byRarity.items.map((row) => row.product.rarity).every((rarity) => rarity === "Covert")).toBe(true);
    expect(byRarity.total).toBe(2);

    const byGame = await listingsRepository.findMany({
      skip: 0,
      take: 20,
      where: { product: { game: { equals: "CSGO", mode: "insensitive" } } },
    });
    expect(byGame.items).toHaveLength(1);
    expect(byGame.items[0]?.productId).toBe(csgo.id);
    expect(byRarity.items.some((row) => row.id === covertListing.id)).toBe(true);
  });
});
