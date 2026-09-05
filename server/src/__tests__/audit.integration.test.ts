import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { app } from "../app.js";
import { prisma } from "../shared/database/index.js";
import { signAccessToken } from "../shared/utils/jwt.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { sellersService } from "../modules/sellers/sellers.service.js";
import { AuditAction } from "../modules/audit/audit.types.js";
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

describe("audit trail (postgres)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await listen();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server has no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await close(server);
  });

  it("persists a non-sensitive before/after row for listing cancel", async () => {
    const fixture = await createCheckoutGraph();
    await listingsService.cancel(fixture.listings[0].id, fixture.sellerUser.id, "SELLER", {
      actorId: fixture.sellerUser.id,
      actorRole: "SELLER",
      ip: "198.51.100.20",
      userAgent: "integration-test",
    });

    const row = await prisma.auditLog.findFirst({
      where: { resourceId: fixture.listings[0].id, action: AuditAction.LISTING_CANCEL },
    });
    expect(row).toMatchObject({
      actorId: fixture.sellerUser.id,
      actorRole: "SELLER",
      resourceType: "Listing",
      ip: "198.51.100.20",
      userAgent: "integration-test",
    });
    expect(row?.before).toEqual({ status: "ACTIVE" });
    expect(row?.after).toEqual({ status: "CANCELED" });
  });

  it("persists seller approval and payment confirmation without secrets", async () => {
    const fixture = await createCheckoutGraph();
    const pendingSeller = await prisma.seller.update({
      where: { id: fixture.seller.id },
      data: { isApproved: false },
    });
    await sellersService.approve(pendingSeller.id, true, {
      actorId: "admin-actor",
      actorRole: "ADMIN",
    });

    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("audit-pay"));
    await paymentsService.confirmPayment(created.id);

    const approval = await prisma.auditLog.findFirst({
      where: { resourceId: fixture.seller.id, action: AuditAction.SELLER_APPROVAL_CHANGED },
    });
    expect(approval?.before).toEqual({ isApproved: false });
    expect(approval?.after).toEqual({ isApproved: true });

    const payment = await prisma.auditLog.findFirst({
      where: { resourceId: created.id, action: AuditAction.PAYMENT_CONFIRMED },
    });
    expect(payment?.actorId).toBeNull();
    expect(payment?.before).toEqual({ paymentStatus: "PENDING", status: "PENDING" });
    expect(payment?.after).toEqual({ paymentStatus: "PAID", status: "CONFIRMED" });

    const serialized = JSON.stringify([approval, payment]);
    expect(serialized).not.toMatch(/password|secret|Bearer |paypal-transmission-sig|accessToken/i);
  });

  it("lets ADMIN list audit logs and forbids CUSTOMER and SELLER", async () => {
    const admin = await createUser({ name: "Admin", role: "ADMIN" });
    const fixture = await createCheckoutGraph();
    await listingsService.updatePrice(fixture.listings[0].id, fixture.sellerUser.id, "SELLER", {
      newPrice: 125,
    });

    const adminToken = signAccessToken({ sub: admin.id, email: admin.email, role: "ADMIN" });
    const customerToken = signAccessToken({
      sub: fixture.customer.id,
      email: fixture.customer.email,
      role: "CUSTOMER",
    });
    const sellerToken = signAccessToken({
      sub: fixture.sellerUser.id,
      email: fixture.sellerUser.email,
      role: "SELLER",
    });

    const listed = await fetch(`${baseUrl}/admin/audit-logs?resourceType=Listing`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { items: Array<{ action: string; before: unknown; after: unknown }> };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.some((item) => item.action === AuditAction.LISTING_PRICE_CHANGE)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/password|secret|Bearer |accessToken/i);

    const customerRead = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(customerRead.status).toBe(403);

    const sellerRead = await fetch(`${baseUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(sellerRead.status).toBe(403);

    const anonymous = await fetch(`${baseUrl}/admin/audit-logs`);
    expect(anonymous.status).toBe(401);
  });

  it("redacts secret keys if a writer attempts to persist them", async () => {
    const { auditRepository } = await import("../modules/audit/audit.repository.js");
    await auditRepository.create({
      actorId: "admin-1",
      actorRole: "ADMIN",
      action: "TEST_REDACT",
      resourceType: "Seller",
      resourceId: "seller-x",
      before: { password: "hunter2", isApproved: false },
      after: { accessToken: "abc", isApproved: true },
    });

    const row = await prisma.auditLog.findFirst({ where: { action: "TEST_REDACT" } });
    expect(row?.before).toEqual({ password: "[REDACTED]", isApproved: false });
    expect(row?.after).toEqual({ accessToken: "[REDACTED]", isApproved: true });
  });
});
