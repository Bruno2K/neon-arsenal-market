import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { Prisma } from "@prisma/client";
import { app } from "../app.js";
import { prisma } from "../shared/database/index.js";
import { signAccessToken } from "../shared/utils/jwt.js";
import { API_V1_PREFIX } from "../shared/http/apiVersion.js";
import { createListing, createProduct, createSeller, createUser } from "./helpers/index.js";

function listen() {
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function authHeader(user: { id: string; email: string; role: "CUSTOMER" | "SELLER" | "ADMIN" }) {
  return `Bearer ${signAccessToken({ sub: user.id, email: user.email, role: user.role })}`;
}

describe("favorites API (postgres, #106 / SPEC-0004)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.RATE_LIMIT_API_MAX = "10000";
    server = await listen();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  async function seedCustomerAndListing(status: "ACTIVE" | "SOLD" = "ACTIVE") {
    const customer = await createUser({ role: "CUSTOMER" });
    const seller = await createSeller();
    const product = await createProduct();
    const listing = await createListing({
      productId: product.id,
      sellerId: seller.id,
      status,
    });
    return { customer, listing };
  }

  it("enforces unique (userId, listingId) in PostgreSQL", async () => {
    const { customer, listing } = await seedCustomerAndListing();
    await prisma.favorite.create({ data: { userId: customer.id, listingId: listing.id } });

    let caught: unknown;
    try {
      await prisma.favorite.create({ data: { userId: customer.id, listingId: listing.id } });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
    expect(await prisma.favorite.count({ where: { userId: customer.id } })).toBe(1);
  });

  it("rejects concurrent duplicate inserts with one P2002 and one row", async () => {
    const { customer, listing } = await seedCustomerAndListing();
    const payload = { userId: customer.id, listingId: listing.id };
    const results = await Promise.allSettled([
      prisma.favorite.create({ data: payload }),
      prisma.favorite.create({ data: payload }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "P2002" });
    expect(await prisma.favorite.count({ where: payload })).toBe(1);
  });

  it("returns 401 without a JWT on /favorites and /api/v1/favorites", async () => {
    const [alias, versioned] = await Promise.all([
      fetch(`${baseUrl}/favorites`),
      fetch(`${baseUrl}${API_V1_PREFIX}/favorites`),
    ]);
    expect(alias.status).toBe(401);
    expect(versioned.status).toBe(401);
  });

  it("returns 403 for a SELLER token", async () => {
    const sellerUser = await createUser({ role: "SELLER" });
    const response = await fetch(`${baseUrl}${API_V1_PREFIX}/favorites`, {
      headers: { Authorization: authHeader({ ...sellerUser, role: "SELLER" }) },
    });
    expect(response.status).toBe(403);
  });

  it("POST is idempotent and GET is owner-scoped", async () => {
    const { customer, listing } = await seedCustomerAndListing();
    const other = await createUser({ role: "CUSTOMER" });
    const headers = {
      Authorization: authHeader({ ...customer, role: "CUSTOMER" }),
      "Content-Type": "application/json",
    };

    const first = await fetch(`${baseUrl}${API_V1_PREFIX}/favorites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ listingId: listing.id, userId: other.id }),
    });
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ listingId: listing.id });

    const duplicate = await fetch(`${baseUrl}/favorites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ listingId: listing.id }),
    });
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({ listingId: listing.id });
    expect(await prisma.favorite.count({ where: { userId: customer.id, listingId: listing.id } })).toBe(1);
    expect(await prisma.favorite.count({ where: { userId: other.id } })).toBe(0);

    const ownerList = await fetch(`${baseUrl}${API_V1_PREFIX}/favorites`, {
      headers: { Authorization: authHeader({ ...customer, role: "CUSTOMER" }) },
    });
    expect(ownerList.status).toBe(200);
    const ownerBody = (await ownerList.json()) as { items: Array<{ listingId: string }> };
    expect(ownerBody.items.map((item) => item.listingId)).toEqual([listing.id]);

    const otherList = await fetch(`${baseUrl}/favorites`, {
      headers: { Authorization: authHeader({ ...other, role: "CUSTOMER" }) },
    });
    expect(otherList.status).toBe(200);
    await expect(otherList.json()).resolves.toEqual({ items: [] });
  });

  it("cannot delete another customer's favorite and repeated DELETE is 204", async () => {
    const { customer, listing } = await seedCustomerAndListing();
    const other = await createUser({ role: "CUSTOMER" });
    await prisma.favorite.create({ data: { userId: customer.id, listingId: listing.id } });

    const strangerDelete = await fetch(`${baseUrl}${API_V1_PREFIX}/favorites/${listing.id}`, {
      method: "DELETE",
      headers: { Authorization: authHeader({ ...other, role: "CUSTOMER" }) },
    });
    expect(strangerDelete.status).toBe(204);
    expect(await prisma.favorite.count({ where: { userId: customer.id, listingId: listing.id } })).toBe(1);

    const ownerDelete = await fetch(`${baseUrl}/favorites/${listing.id}`, {
      method: "DELETE",
      headers: { Authorization: authHeader({ ...customer, role: "CUSTOMER" }) },
    });
    expect(ownerDelete.status).toBe(204);
    expect(await prisma.favorite.count({ where: { userId: customer.id, listingId: listing.id } })).toBe(0);

    const again = await fetch(`${baseUrl}${API_V1_PREFIX}/favorites/${listing.id}`, {
      method: "DELETE",
      headers: { Authorization: authHeader({ ...customer, role: "CUSTOMER" }) },
    });
    expect(again.status).toBe(204);
  });

  it("returns 404 for a missing listing and does not change listing status", async () => {
    const { customer, listing } = await seedCustomerAndListing("SOLD");
    const headers = {
      Authorization: authHeader({ ...customer, role: "CUSTOMER" }),
      "Content-Type": "application/json",
    };

    const missing = await fetch(`${baseUrl}${API_V1_PREFIX}/favorites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ listingId: "clmissinglistingid0000000001" }),
    });
    expect(missing.status).toBe(404);

    const saved = await fetch(`${baseUrl}/favorites`, {
      method: "POST",
      headers,
      body: JSON.stringify({ listingId: listing.id }),
    });
    expect(saved.status).toBe(200);
    const after = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(after?.status).toBe("SOLD");
  });
});
