import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { app } from "../app.js";
import { signAccessToken } from "../shared/utils/jwt.js";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

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

describe("API authorization security (postgres)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.RATE_LIMIT_API_MAX = "10000";
    process.env.RATE_LIMIT_AUTH_MAX = "10000";
    server = await listen();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  it(`${DomainInvariant.AUTH_OWNERSHIP}: a customer cannot read another customer's order`, async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("idor"));
    const stranger = await createUser({ name: "Stranger", role: "CUSTOMER" });
    const token = signAccessToken({
      sub: stranger.id,
      email: stranger.email,
      role: "CUSTOMER",
    });

    const response = await fetch(`${baseUrl}/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Not your order");
    expect(JSON.stringify(body)).not.toContain(order.id);
  });

  it("forbids CUSTOMER from admin routes and anonymous admin reads", async () => {
    const customer = await createUser({ name: "Buyer", role: "CUSTOMER" });
    const token = signAccessToken({
      sub: customer.id,
      email: customer.email,
      role: "CUSTOMER",
    });

    const forbidden = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(forbidden.status).toBe(403);

    const anonymous = await fetch(`${baseUrl}/admin/users`);
    expect(anonymous.status).toBe(401);
  });
});
