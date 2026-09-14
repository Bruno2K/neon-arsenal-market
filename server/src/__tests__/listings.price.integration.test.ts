import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { prisma } from "../shared/database/index.js";
import { signAccessToken } from "../shared/utils/jwt.js";
import { errorHandler } from "../shared/errors/index.js";
import { listingsRoutes } from "../modules/listings/listings.routes.js";
import { AuditAction } from "../modules/audit/audit.types.js";
import { createCheckoutGraph } from "./helpers/index.js";

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
 * AUD-015 (PR11): the generic PATCH /listings/:id must not be a second,
 * unaudited path to Listing.price. PATCH /listings/:id/price remains the only
 * path that may change price, and it must stay transactional with PriceHistory
 * and AuditLog.
 */
describe("listing price mutation paths (postgres)", () => {
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

  it("rejects a price field on the generic PATCH and leaves price, PriceHistory, and AuditLog unchanged", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const before = await prisma.listing.findUnique({ where: { id: listingId } });
    const sellerToken = signAccessToken({
      sub: fixture.sellerUser.id,
      email: fixture.sellerUser.email,
      role: "SELLER",
    });

    const response = await fetch(`${baseUrl}/listings/${listingId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ price: 999 }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/price/i);

    const after = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(after?.price.toString()).toBe(before?.price.toString());

    const history = await prisma.priceHistory.findMany({ where: { listingId } });
    expect(history).toHaveLength(0);

    const audit = await prisma.auditLog.findMany({
      where: { resourceId: listingId, action: AuditAction.LISTING_PRICE_CHANGE },
    });
    expect(audit).toHaveLength(0);
  });

  it("still allows the dedicated PATCH /listings/:id/price to change price, PriceHistory, and AuditLog atomically", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const before = await prisma.listing.findUnique({ where: { id: listingId } });
    const sellerToken = signAccessToken({
      sub: fixture.sellerUser.id,
      email: fixture.sellerUser.email,
      role: "SELLER",
    });

    const response = await fetch(`${baseUrl}/listings/${listingId}/price`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newPrice: 150 }),
    });

    expect(response.status).toBe(200);

    const after = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(after?.price.toString()).toBe("150");
    expect(after?.price.toString()).not.toBe(before?.price.toString());

    const history = await prisma.priceHistory.findMany({ where: { listingId } });
    expect(history).toHaveLength(1);
    expect(history[0].oldPrice.toString()).toBe(before?.price.toString());
    expect(history[0].newPrice.toString()).toBe("150");

    const audit = await prisma.auditLog.findMany({
      where: { resourceId: listingId, action: AuditAction.LISTING_PRICE_CHANGE },
    });
    expect(audit).toHaveLength(1);
  });
});
