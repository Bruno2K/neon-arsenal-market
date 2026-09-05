import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { createCheckoutGraph, createOrder, createUser, orderKey, uniqueSuffix } from "./helpers/index.js";

function expectDatabaseOrPrismaEnumRejection(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.name}` : String(error);
  const prismaValidation = error instanceof Prisma.PrismaClientValidationError;
  const known = error instanceof Prisma.PrismaClientKnownRequestError ? error : null;
  const pgEnum =
    /invalid input value for enum/i.test(message) ||
    /invalid_text_representation/i.test(message) ||
    (known !== null && (known.code === "P2010" || known.code === "P2006" || known.code === "P2023"));
  expect(prismaValidation || pgEnum).toBe(true);
}

describe("PostgreSQL domain enums", () => {
  it("rejects an invalid role through the Prisma client (not only TypeScript)", async () => {
    let caught: unknown;
    try {
      await prisma.user.create({
        data: {
          name: "Bad Role",
          email: `bad-role-${uniqueSuffix()}@test.local`,
          password: "hash",
          role: "SUPERUSER" as never,
        },
      });
    } catch (error) {
      caught = error;
    }
    expectDatabaseOrPrismaEnumRejection(caught);
    expect(await prisma.user.count({ where: { email: { contains: "bad-role-" } } })).toBe(0);
  });

  it("rejects invalid enum labels at PostgreSQL, including the other status spelling", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("enum-reject")
    );
    const listingId = fixture.listings[0].id;
    const userId = fixture.customer.id;

    const attempts: Array<{ sql: string; values: string[] }> = [
      {
        sql: `UPDATE "User" SET "role" = $1 WHERE "id" = $2`,
        values: ["SUPERUSER", userId],
      },
      {
        sql: `UPDATE "Order" SET "status" = $1 WHERE "id" = $2`,
        values: ["CANCELED", order.id],
      },
      {
        sql: `UPDATE "Order" SET "paymentStatus" = $1 WHERE "id" = $2`,
        values: ["CAPTURED", order.id],
      },
      {
        sql: `UPDATE "Listing" SET "status" = $1 WHERE "id" = $2`,
        values: ["CANCELLED", listingId],
      },
      {
        sql: `UPDATE "PaymentWebhookEvent" SET "status" = $1 WHERE "id" = $2`,
        values: ["ACKED", "placeholder"],
      },
    ];

    const webhook = await prisma.paymentWebhookEvent.create({
      data: {
        provider: "PAYPAL",
        externalEventId: `WH-enum-${uniqueSuffix()}`,
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        status: "RECEIVED",
      },
    });
    attempts[4].values[1] = webhook.id;

    for (const attempt of attempts) {
      let caught: unknown;
      try {
        await prisma.$executeRawUnsafe(attempt.sql, ...attempt.values);
      } catch (error) {
        caught = error;
      }
      expectDatabaseOrPrismaEnumRejection(caught);
    }

    const persistedUser = await prisma.user.findUnique({ where: { id: userId } });
    const persistedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    const persistedListing = await prisma.listing.findUnique({ where: { id: listingId } });
    const persistedWebhook = await prisma.paymentWebhookEvent.findUnique({ where: { id: webhook.id } });

    expect(persistedUser?.role).toBe("CUSTOMER");
    expect(persistedOrder?.status).toBe("PENDING");
    expect(persistedOrder?.paymentStatus).toBe("PENDING");
    expect(persistedListing?.status).toBe("RESERVED");
    expect(persistedWebhook?.status).toBe("RECEIVED");
  });

  it("still persists unknown PayPal eventType as text so webhooks can be ignored", async () => {
    const event = await prisma.paymentWebhookEvent.create({
      data: {
        provider: "PAYPAL",
        externalEventId: `WH-unknown-type-${uniqueSuffix()}`,
        eventType: "BILLING.SUBSCRIPTION.CREATED",
        status: "IGNORED",
      },
    });
    expect(event.eventType).toBe("BILLING.SUBSCRIPTION.CREATED");
    expect(event.status).toBe("IGNORED");
    expect(event.provider).toBe("PAYPAL");
  });

  it("rejects invalid PaymentLink and OrderIdempotencyKey claim statuses in PostgreSQL", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("claim-enum")
    );

    const link = await prisma.paymentLink.create({
      data: { orderId: order.id, status: "IN_PROGRESS" },
    });
    const key = await prisma.orderIdempotencyKey.findUnique({
      where: { orderId: order.id },
    });
    expect(key).not.toBeNull();

    let linkError: unknown;
    try {
      await prisma.$executeRawUnsafe(`UPDATE "PaymentLink" SET "status" = $1 WHERE "orderId" = $2`, "DONE", link.orderId);
    } catch (error) {
      linkError = error;
    }
    expectDatabaseOrPrismaEnumRejection(linkError);

    let keyError: unknown;
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "OrderIdempotencyKey" SET "status" = $1 WHERE "id" = $2`,
        "DONE",
        key!.id
      );
    } catch (error) {
      keyError = error;
    }
    expectDatabaseOrPrismaEnumRejection(keyError);

    expect((await prisma.paymentLink.findUnique({ where: { orderId: order.id } }))?.status).toBe("IN_PROGRESS");
    expect((await prisma.orderIdempotencyKey.findUnique({ where: { id: key!.id } }))?.status).toBe("COMPLETED");
  });

  it("rejects an invalid seller transaction status at PostgreSQL", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("txn-enum")
    );
    const txn = await prisma.sellerTransaction.create({
      data: {
        sellerId: fixture.seller.id,
        orderId: order.id,
        grossAmount: new Prisma.Decimal("100"),
        commissionAmount: new Prisma.Decimal("10"),
        netAmount: new Prisma.Decimal("90"),
        status: "PAID",
      },
    });

    let caught: unknown;
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "SellerTransaction" SET "status" = $1 WHERE "id" = $2`,
        "SETTLED",
        txn.id
      );
    } catch (error) {
      caught = error;
    }
    expectDatabaseOrPrismaEnumRejection(caught);
    expect((await prisma.sellerTransaction.findUnique({ where: { id: txn.id } }))?.status).toBe("PAID");
  });

  it("allows every documented listing and order status value", async () => {
    const sellerUser = await createUser({ role: "SELLER" });
    const fixture = await createCheckoutGraph();
    const listing = await prisma.listing.create({
      data: {
        productId: fixture.product.id,
        sellerId: fixture.seller.id,
        floatValue: new Prisma.Decimal("0.12"),
        price: new Prisma.Decimal("10"),
        status: "CANCELED",
      },
    });
    expect(listing.status).toBe("CANCELED");

    const admin = await createUser({ role: "ADMIN", name: "Admin Enum" });
    expect(admin.role).toBe("ADMIN");
    expect(sellerUser.role).toBe("SELLER");

    const order = await prisma.order.create({
      data: {
        customerId: fixture.customer.id,
        totalAmount: new Prisma.Decimal("10"),
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
      },
    });
    expect(order.status).toBe("CANCELLED");
    expect(order.paymentStatus).toBe("REFUNDED");
  });
});
