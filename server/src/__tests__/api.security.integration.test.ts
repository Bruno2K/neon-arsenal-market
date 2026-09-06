import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { app } from "../app.js";
import { prisma } from "../shared/database/index.js";
import { signAccessToken } from "../shared/utils/jwt.js";
import { DomainInvariant } from "../shared/domain/invariants.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import {
  createCheckoutGraph,
  createOrder,
  createSeller,
  createUser,
  orderKey,
  uniqueSuffix,
} from "./helpers/index.js";

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

function bearer(user: { id: string; email: string; role: "ADMIN" | "SELLER" | "CUSTOMER" }) {
  return `Bearer ${signAccessToken({ sub: user.id, email: user.email, role: user.role })}`;
}

async function jsonRequest(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return {
    status: response.status,
    json: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

describe("API authorization and payment threat suite (postgres)", () => {
  let server: Server;
  let baseUrl: string;
  let previousWebhookId: string | undefined;

  beforeAll(async () => {
    process.env.RATE_LIMIT_API_MAX = "10000";
    process.env.RATE_LIMIT_AUTH_MAX = "10000";
    previousWebhookId = process.env.PAYPAL_WEBHOOK_ID;
    process.env.PAYPAL_WEBHOOK_ID = "security-suite-webhook-id";
    server = await listen();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousWebhookId === undefined) delete process.env.PAYPAL_WEBHOOK_ID;
    else process.env.PAYPAL_WEBHOOK_ID = previousWebhookId;
    await close(server);
  });

  it(`${DomainInvariant.AUTH_OWNERSHIP}: a customer cannot read another customer's order`, async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("idor"));
    const stranger = await createUser({ name: "Stranger", role: "CUSTOMER" });

    const response = await jsonRequest(baseUrl, `/orders/${order.id}`, {
      headers: { Authorization: bearer(stranger) },
    });
    expect(response.status).toBe(403);
    expect(response.json.error).toBe("Not your order");
    expect(JSON.stringify(response.json)).not.toContain(order.id);
  });

  it(`${DomainInvariant.AUTH_OWNERSHIP}: a seller without items cannot read another seller's order`, async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("seller-idor"));
    const otherSellerUser = await createUser({ name: "Other Seller", role: "SELLER" });
    await createSeller(otherSellerUser.id);

    const response = await jsonRequest(baseUrl, `/orders/${order.id}`, {
      headers: { Authorization: bearer(otherSellerUser) },
    });
    expect(response.status).toBe(403);
    expect(response.json.error).toBe("Not your order");
  });

  it(`${DomainInvariant.AUTH_OWNERSHIP}: a seller cannot reprice another seller's listing`, async () => {
    const fixture = await createCheckoutGraph();
    const otherSellerUser = await createUser({ name: "Rival Seller", role: "SELLER" });
    await createSeller(otherSellerUser.id);
    const listingId = fixture.listings[0].id;

    const patch = await jsonRequest(baseUrl, `/listings/${listingId}`, {
      method: "PATCH",
      headers: {
        Authorization: bearer(otherSellerUser),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ price: 1 }),
    });
    expect(patch.status).toBe(403);
    expect(patch.json.error).toBe("Not your listing");

    const price = await jsonRequest(baseUrl, `/listings/${listingId}/price`, {
      method: "PATCH",
      headers: {
        Authorization: bearer(otherSellerUser),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ newPrice: 1 }),
    });
    expect(price.status).toBe(403);

    const committed = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(committed?.price.equals(new Prisma.Decimal("100.00"))).toBe(true);
  });

  it("forbids CUSTOMER from admin routes and anonymous admin reads", async () => {
    const customer = await createUser({ name: "Buyer", role: "CUSTOMER" });

    const forbidden = await jsonRequest(baseUrl, "/admin/users", {
      headers: { Authorization: bearer(customer) },
    });
    expect(forbidden.status).toBe(403);

    const anonymous = await jsonRequest(baseUrl, "/admin/users");
    expect(anonymous.status).toBe(401);
  });

  it("rejects self-registration as ADMIN and role escalation via PATCH /users/me", async () => {
    const register = await jsonRequest(baseUrl, "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Would-be Admin",
        email: `escalation-${uniqueSuffix()}@test.local`,
        password: "secret12",
        role: "ADMIN",
      }),
    });
    expect(register.status).toBe(400);

    const customer = await createUser({ name: "Buyer", role: "CUSTOMER" });
    const patched = await jsonRequest(baseUrl, "/users/me", {
      method: "PATCH",
      headers: {
        Authorization: bearer(customer),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Still Customer", role: "ADMIN" }),
    });
    expect(patched.status).toBe(200);
    expect(patched.json.role).toBe("CUSTOMER");

    const persisted = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(persisted?.role).toBe("CUSTOMER");
    expect(persisted?.name).toBe("Still Customer");
  });

  it("rejects a JWT signed with the wrong secret even if it claims ADMIN", async () => {
    const forged = jwt.sign(
      {
        sub: "forged-admin",
        email: "forged@test.local",
        role: "ADMIN",
        type: "access",
        jti: "forged-jti",
      },
      "not-the-server-secret"
    );

    const response = await jsonRequest(baseUrl, "/admin/users", {
      headers: { Authorization: `Bearer ${forged}` },
    });
    expect(response.status).toBe(401);
  });

  it(`${DomainInvariant.PAYMENT_TRUSTED_CONFIRM}: CUSTOMER cannot force CONFIRMED or PAID`, async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("status-abuse")
    );

    const confirmed = await jsonRequest(baseUrl, `/orders/${order.id}/status`, {
      method: "PATCH",
      headers: {
        Authorization: bearer(fixture.customer),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "CONFIRMED", paymentStatus: "PAID" }),
    });
    expect(confirmed.status).toBe(403);

    const sellerStatus = await jsonRequest(baseUrl, `/orders/${order.id}/status`, {
      method: "PATCH",
      headers: {
        Authorization: bearer(fixture.sellerUser),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    expect(sellerStatus.status).toBe(403);

    const committed = await prisma.order.findUnique({ where: { id: order.id } });
    expect(committed?.status).toBe("PENDING");
    expect(committed?.paymentStatus).toBe("PENDING");
  });

  it(`${DomainInvariant.PAYMENT_WEBHOOK_AUTHENTIC}: invalid or replayed webhook signatures are rejected`, async () => {
    const payload = {
      id: `WH-security-${uniqueSuffix()}`,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAPTURE-1" },
    };

    const missing = await jsonRequest(baseUrl, "/payments/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(missing.status).toBe(401);
    expect(missing.json.error).toBe("Invalid webhook signature");

    const stale = await jsonRequest(baseUrl, "/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "paypal-transmission-id": "tx-stale",
        "paypal-transmission-time": "2020-01-01T00:00:00Z",
        "paypal-transmission-sig": "not-a-valid-signature",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
        "paypal-auth-algo": "SHA256withRSA",
      },
      body: JSON.stringify(payload),
    });
    expect(stale.status).toBe(401);

    const events = await prisma.paymentWebhookEvent.findMany({
      where: { externalEventId: payload.id },
    });
    expect(events).toHaveLength(0);
  });

  it(`${DomainInvariant.AUTH_OWNERSHIP}: a stranger cannot create or capture payment for someone else's order`, async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("pay-idor")
    );
    const stranger = await createUser({ name: "Thief", role: "CUSTOMER" });

    const create = await jsonRequest(baseUrl, "/payments/create", {
      method: "POST",
      headers: {
        Authorization: bearer(stranger),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId: order.id, amount: "0.01" }),
    });
    expect(create.status).toBe(403);

    const capture = await jsonRequest(baseUrl, "/payments/capture", {
      method: "POST",
      headers: {
        Authorization: bearer(stranger),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId: order.id }),
    });
    expect(capture.status).toBe(403);
  });

  it(`${DomainInvariant.LISTING_RESERVATION_TTL}: expired reservation cannot be purchased`, async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const order = await createOrder(fixture.customer.id, [listingId], orderKey("expired-buy"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });

    await expect(paymentsService.confirmPayment(order.id)).rejects.toMatchObject({
      statusCode: 409,
    });

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: order.id } });
    expect(listing?.status).not.toBe("SOLD");
    expect(paid?.paymentStatus).toBe("PENDING");
    expect(txns).toHaveLength(0);
  });

  it(`${DomainInvariant.ORDER_PRICE_SNAPSHOT}: client-supplied item price does not change the snapshot`, async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;

    const created = await jsonRequest(baseUrl, "/orders", {
      method: "POST",
      headers: {
        Authorization: bearer(fixture.customer),
        "Content-Type": "application/json",
        "Idempotency-Key": orderKey("price-tamper"),
      },
      body: JSON.stringify({
        items: [{ listingId, price: 0.01, totalAmount: "0.01" }],
        totalAmount: "0.01",
      }),
    });
    expect(created.status).toBe(201);
    expect(new Prisma.Decimal(String(created.json.totalAmount)).equals(new Prisma.Decimal("100.00"))).toBe(
      true
    );

    const items = await prisma.orderItem.findMany({
      where: { orderId: created.json.id as string },
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.priceSnapshot.equals(new Prisma.Decimal("100.00"))).toBe(true);
  });

  it("CUSTOMER cannot mark a listing SOLD and SELLER cannot use the admin sold path", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;

    const customer = await jsonRequest(baseUrl, `/listings/${listingId}/mark-sold`, {
      method: "POST",
      headers: { Authorization: bearer(fixture.customer) },
    });
    expect(customer.status).toBe(403);

    const seller = await jsonRequest(baseUrl, `/listings/${listingId}/mark-sold`, {
      method: "POST",
      headers: { Authorization: bearer(fixture.sellerUser) },
    });
    expect(seller.status).toBe(403);

    const committed = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(committed?.status).toBe("ACTIVE");
  });
});
