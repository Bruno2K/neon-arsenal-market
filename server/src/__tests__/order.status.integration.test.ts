import { describe, expect, it } from "vitest";
import { AppError } from "../shared/errors/AppError.js";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

describe("order status machine (postgres)", () => {
  it("persists ADMIN PENDING → CONFIRMED and rejects an illegal skip", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("admin-confirm"));

    const confirmed = await ordersService.updateStatus(created.id, "admin-id", "ADMIN", "CONFIRMED");
    expect(confirmed.status).toBe("CONFIRMED");

    const committed = await prisma.order.findUnique({ where: { id: created.id } });
    expect(committed?.status).toBe("CONFIRMED");

    await expect(
      ordersService.updateStatus(created.id, "admin-id", "ADMIN", "DELIVERED")
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid status transition from CONFIRMED to DELIVERED",
    });

    const unchanged = await prisma.order.findUnique({ where: { id: created.id } });
    expect(unchanged?.status).toBe("CONFIRMED");
  });

  it("walks CONFIRMED → SHIPPED → DELIVERED and then refuses further changes", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("fulfill"));
    await prisma.order.update({ where: { id: created.id }, data: { status: "CONFIRMED" } });

    const shipped = await ordersService.updateStatus(created.id, "admin-id", "ADMIN", "SHIPPED");
    expect(shipped.status).toBe("SHIPPED");

    const delivered = await ordersService.updateStatus(created.id, "admin-id", "ADMIN", "DELIVERED");
    expect(delivered.status).toBe("DELIVERED");

    await expect(
      ordersService.updateStatus(created.id, "admin-id", "ADMIN", "CANCELLED")
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid status transition from DELIVERED to CANCELLED",
    });

    const committed = await prisma.order.findUnique({ where: { id: created.id } });
    expect(committed?.status).toBe("DELIVERED");
  });

  it("lets CUSTOMER cancel their own PENDING order and forbids skipping payment", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("customer-cancel"));

    await expect(
      ordersService.updateStatus(created.id, fixture.customer.id, "CUSTOMER", "CONFIRMED")
    ).rejects.toMatchObject({ statusCode: 403 });

    const cancelled = await ordersService.updateStatus(
      created.id,
      fixture.customer.id,
      "CUSTOMER",
      "CANCELLED"
    );
    expect(cancelled.status).toBe("CANCELLED");

    const committed = await prisma.order.findUnique({ where: { id: created.id } });
    expect(committed?.status).toBe("CANCELLED");
    expect(committed?.paymentStatus).toBe("PENDING");

    await expect(
      ordersService.updateStatus(created.id, fixture.customer.id, "CUSTOMER", "PENDING")
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid status transition from CANCELLED to PENDING",
    });
  });

  it("lets CUSTOMER confirm receipt of a SHIPPED order", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("receipt"));
    await prisma.order.update({ where: { id: created.id }, data: { status: "SHIPPED" } });

    const delivered = await ordersService.updateStatus(
      created.id,
      fixture.customer.id,
      "CUSTOMER",
      "DELIVERED"
    );
    expect(delivered.status).toBe("DELIVERED");
  });

  it("does not let SELLER change fulfillment status", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("seller-denied"));

    await expect(
      ordersService.updateStatus(created.id, fixture.sellerUser.id, "SELLER", "CANCELLED")
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Sellers cannot edit orders",
    });

    const committed = await prisma.order.findUnique({ where: { id: created.id } });
    expect(committed?.status).toBe("PENDING");
  });

  it("does not let CUSTOMER cancel another customer's order", async () => {
    const fixture = await createCheckoutGraph();
    const other = await createUser({ name: "Other buyer" });
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("not-yours"));

    await expect(
      ordersService.updateStatus(created.id, other.id, "CUSTOMER", "CANCELLED")
    ).rejects.toMatchObject({ statusCode: 403, message: "Not your order" });

    const committed = await prisma.order.findUnique({ where: { id: created.id } });
    expect(committed?.status).toBe("PENDING");
  });

  it("allows only one concurrent transition to win from PENDING", async () => {
    const fixture = await createCheckoutGraph();
    const created = await createOrder(fixture.customer.id, [fixture.listings[0].id], orderKey("race"));

    const results = await Promise.allSettled([
      ordersService.updateStatus(created.id, "admin-id", "ADMIN", "CONFIRMED"),
      ordersService.updateStatus(created.id, "admin-id", "ADMIN", "CANCELLED"),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const conflict = (rejected[0] as PromiseRejectedResult).reason as AppError;
    expect(conflict).toMatchObject({ statusCode: 409, message: "Order status changed concurrently" });

    const committed = await prisma.order.findUnique({ where: { id: created.id } });
    expect(["CONFIRMED", "CANCELLED"]).toContain(committed?.status);
    expect(committed?.status).toBe(
      (fulfilled[0] as PromiseFulfilledResult<{ status: string }>).value.status
    );
  });
});
