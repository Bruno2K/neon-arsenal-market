import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../shared/database/index.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

function expectUniqueViolation(error: unknown, tokens: string[]) {
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  const known = error as Prisma.PrismaClientKnownRequestError;
  expect(known.code).toBe("P2002");
  const target = known.meta?.target;
  const haystack = Array.isArray(target) ? target.join(",") : String(target ?? "");
  for (const token of tokens) {
    expect(haystack).toContain(token);
  }
}

function expectCheckViolation(error: unknown, constraint: string) {
  expect(error).toBeDefined();
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  expect(code === "P2004" || /23514|check constraint/i.test(message)).toBe(true);
  expect(message).toContain(constraint);
}

describe("PostgreSQL unique constraints", () => {
  it("defaults listings to BRL and rejects another checkout currency", async () => {
    const fixture = await createCheckoutGraph();
    expect(fixture.listings[0].currency).toBe("BRL");

    let caught: unknown;
    try {
      await prisma.listing.create({
        data: {
          productId: fixture.product.id,
          sellerId: fixture.seller.id,
          floatValue: new Prisma.Decimal("0.20"),
          price: new Prisma.Decimal("50.00"),
          currency: "USD",
          status: "ACTIVE",
        },
      });
    } catch (error) {
      caught = error;
    }

    expectCheckViolation(caught, "Listing_currency_brl_chk");
  });

  it("enforces OrderIdempotencyKey(customerId, key)", async () => {
    const customer = await createUser();
    await prisma.orderIdempotencyKey.create({
      data: {
        customerId: customer.id,
        key: "ABC",
        requestHash: "hash-1",
        status: "COMPLETED",
      },
    });

    let caught: unknown;
    try {
      await prisma.orderIdempotencyKey.create({
        data: {
          customerId: customer.id,
          key: "ABC",
          requestHash: "hash-2",
          status: "IN_PROGRESS",
        },
      });
    } catch (error) {
      caught = error;
    }

    expectUniqueViolation(caught, ["customerId", "key"]);
    expect(await prisma.orderIdempotencyKey.count({ where: { customerId: customer.id } })).toBe(1);
  });

  it("rejects concurrent inserts of the same customerId + key with one P2002", async () => {
    const customer = await createUser();
    const payload = {
      customerId: customer.id,
      key: "ABC",
      requestHash: "hash-concurrent",
      status: "IN_PROGRESS" as const,
    };

    const results = await Promise.allSettled([
      prisma.orderIdempotencyKey.create({ data: payload }),
      prisma.orderIdempotencyKey.create({ data: payload }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expectUniqueViolation((rejected[0] as PromiseRejectedResult).reason, ["customerId", "key"]);
    expect(await prisma.orderIdempotencyKey.count({ where: { customerId: customer.id, key: "ABC" } })).toBe(
      1
    );
  });

  it("allows the same idempotency key for two customers", async () => {
    const customerA = await createUser({ name: "A" });
    const customerB = await createUser({ name: "B" });

    await prisma.orderIdempotencyKey.create({
      data: { customerId: customerA.id, key: "ABC", requestHash: "a", status: "COMPLETED" },
    });
    await prisma.orderIdempotencyKey.create({
      data: { customerId: customerB.id, key: "ABC", requestHash: "b", status: "COMPLETED" },
    });

    expect(await prisma.orderIdempotencyKey.count({ where: { key: "ABC" } })).toBe(2);
  });

  it("enforces User.email uniqueness separately from idempotency keys", async () => {
    await createUser({ email: "shared@test.local" });

    let caught: unknown;
    try {
      await createUser({ email: "shared@test.local" });
    } catch (error) {
      caught = error;
    }

    expectUniqueViolation(caught, ["email"]);
    expect(await prisma.user.count({ where: { email: "shared@test.local" } })).toBe(1);
  });

  it("enforces PaymentWebhookEvent(provider, externalEventId)", async () => {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: "PAYPAL",
        externalEventId: "WH-constraint",
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        status: "RECEIVED",
      },
    });

    await expect(
      prisma.paymentWebhookEvent.create({
        data: {
          provider: "PAYPAL",
          externalEventId: "WH-constraint",
          eventType: "PAYMENT.CAPTURE.COMPLETED",
          status: "PROCESSED",
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces SellerTransaction(sellerId, orderId)", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("txn-unique")
    );

    await prisma.sellerTransaction.create({
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
      await prisma.sellerTransaction.create({
        data: {
          sellerId: fixture.seller.id,
          orderId: order.id,
          grossAmount: new Prisma.Decimal("100"),
          commissionAmount: new Prisma.Decimal("10"),
          netAmount: new Prisma.Decimal("90"),
          status: "PAID",
        },
      });
    } catch (error) {
      caught = error;
    }

    expectUniqueViolation(caught, ["sellerId", "orderId"]);
    expect(await prisma.sellerTransaction.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("rejects concurrent SellerTransaction inserts for the same seller and order", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("txn-unique-concurrent")
    );
    const payload = {
      sellerId: fixture.seller.id,
      orderId: order.id,
      grossAmount: new Prisma.Decimal("100"),
      commissionAmount: new Prisma.Decimal("10"),
      netAmount: new Prisma.Decimal("90"),
      status: "PAID" as const,
    };

    const results = await Promise.allSettled([
      prisma.sellerTransaction.create({ data: payload }),
      prisma.sellerTransaction.create({ data: payload }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expectUniqueViolation((rejected[0] as PromiseRejectedResult).reason, ["sellerId", "orderId"]);
    expect(await prisma.sellerTransaction.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("rejects a SellerTransaction whose net is not gross minus commission", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("txn-net-check")
    );

    let caught: unknown;
    try {
      await prisma.sellerTransaction.create({
        data: {
          sellerId: fixture.seller.id,
          orderId: order.id,
          grossAmount: new Prisma.Decimal("100"),
          commissionAmount: new Prisma.Decimal("10"),
          netAmount: new Prisma.Decimal("89"),
          status: "PAID",
        },
      });
    } catch (error) {
      caught = error;
    }

    expectCheckViolation(caught, "SellerTransaction_net_identity_chk");
    expect(await prisma.sellerTransaction.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("rejects a SellerTransaction with a negative net amount", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("txn-negative-check")
    );

    let caught: unknown;
    try {
      await prisma.sellerTransaction.create({
        data: {
          sellerId: fixture.seller.id,
          orderId: order.id,
          grossAmount: new Prisma.Decimal("10"),
          commissionAmount: new Prisma.Decimal("20"),
          netAmount: new Prisma.Decimal("-10"),
          status: "PAID",
        },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    const message = caught instanceof Error ? caught.message : String(caught);
    expect(
      /SellerTransaction_amounts_non_negative_chk|SellerTransaction_net_identity_chk|23514|check constraint/i.test(
        message
      )
    ).toBe(true);
    expect(await prisma.sellerTransaction.count({ where: { orderId: order.id } })).toBe(0);
  });

  it("enforces PaymentLink(orderId)", async () => {
    const fixture = await createCheckoutGraph();
    const order = await createOrder(
      fixture.customer.id,
      [fixture.listings[0].id],
      orderKey("payment-link-unique")
    );

    await prisma.paymentLink.create({
      data: { orderId: order.id, status: "IN_PROGRESS" },
    });

    let caught: unknown;
    try {
      await prisma.paymentLink.create({
        data: { orderId: order.id, status: "COMPLETED" },
      });
    } catch (error) {
      caught = error;
    }

    expectUniqueViolation(caught, ["orderId"]);
    expect(await prisma.paymentLink.count({ where: { orderId: order.id } })).toBe(1);
  });
});
