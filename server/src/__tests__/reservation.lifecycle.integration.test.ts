import { describe, expect, it } from "vitest";
import { prisma } from "../shared/database/index.js";
import { ordersService } from "../modules/orders/orders.service.js";
import { paymentsService } from "../modules/payments/payments.service.js";
import { listingsService } from "../modules/listings/listings.service.js";
import { createCheckoutGraph, createOrder, createUser, orderKey } from "./helpers/index.js";

describe("reservation lifecycle (postgres)", () => {
  it("ACTIVE → RESERVED → SOLD persists reservation timestamps", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const before = Date.now();

    const created = await createOrder(fixture.customer.id, [listingId], orderKey("reserve-sold"));
    const reserved = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(reserved?.status).toBe("RESERVED");
    expect(reserved?.reservedByOrderId).toBe(created.id);
    expect(reserved?.reservedAt).toBeInstanceOf(Date);
    expect(reserved?.reservationExpiresAt).toBeInstanceOf(Date);
    expect(reserved!.reservationExpiresAt!.getTime()).toBeGreaterThan(before);

    await paymentsService.confirmPayment(created.id);

    const sold = await prisma.listing.findUnique({ where: { id: listingId } });
    const order = await prisma.order.findUnique({ where: { id: created.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(sold?.status).toBe("SOLD");
    expect(order?.paymentStatus).toBe("PAID");
    expect(order?.status).toBe("CONFIRMED");
    expect(txns).toHaveLength(1);
    expect(seller?.balance.toString()).toBe("90");
  });

  it("allows only one concurrent buyer to reserve a listing", async () => {
    const fixture = await createCheckoutGraph();
    const otherBuyer = await createUser({ name: "Buyer 2" });
    const listingId = fixture.listings[0].id;

    const results = await Promise.allSettled([
      createOrder(fixture.customer.id, [listingId], orderKey("buyer-one")),
      createOrder(otherBuyer.id, [listingId], orderKey("buyer-two")),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const orders = await prisma.order.findMany({
      where: { items: { some: { listingId } } },
    });
    const orderItems = await prisma.orderItem.findMany({ where: { listingId } });
    expect(listing?.status).toBe("RESERVED");
    expect(orders).toHaveLength(1);
    expect(orderItems).toHaveLength(1);
    expect(listing?.reservedByOrderId).toBe(
      (fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof ordersService.create>>>).value.id
    );
  });

  it("returns RESERVED listings to ACTIVE only after expiration", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(fixture.customer.id, [listingId], orderKey("expire-active"));

    await listingsService.expireReservations();
    const stillReserved = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(stillReserved?.status).toBe("RESERVED");

    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    await listingsService.expireReservations();

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const order = await prisma.order.findUnique({ where: { id: created.id } });
    expect(listing?.status).toBe("ACTIVE");
    expect(listing?.reservedAt).toBeNull();
    expect(listing?.reservationExpiresAt).toBeNull();
    expect(listing?.reservedByOrderId).toBeNull();
    expect(order?.status).toBe("CANCELLED");
    expect(order?.paymentStatus).toBe("PENDING");
  });

  it("does not expire a SOLD listing", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(fixture.customer.id, [listingId], orderKey("expire-sold"));
    await paymentsService.confirmPayment(created.id);
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });

    await listingsService.expireReservations();

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(listing?.status).toBe("SOLD");
  });

  it("rejects payment confirmation after the reservation has expired", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(fixture.customer.id, [listingId], orderKey("expired-payment"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });

    await expect(paymentsService.confirmPayment(created.id)).rejects.toMatchObject({
      statusCode: 409,
    });

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const order = await prisma.order.findUnique({ where: { id: created.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });
    expect(listing?.status).toBe("RESERVED");
    expect(order?.paymentStatus).toBe("PENDING");
    expect(order?.status).toBe("PENDING");
    expect(txns).toHaveLength(0);
  });

  it("lets payment confirmation win when the reservation is still valid", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(fixture.customer.id, [listingId], orderKey("payment-wins"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const results = await Promise.allSettled([
      paymentsService.confirmPayment(created.id),
      listingsService.expireReservations(),
    ]);
    await listingsService.expireReservations();

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const order = await prisma.order.findUnique({ where: { id: created.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("fulfilled");
    expect(listing?.status).toBe("SOLD");
    expect(order?.paymentStatus).toBe("PAID");
    expect(order?.status).toBe("CONFIRMED");
    expect(txns).toHaveLength(1);
  });

  it("lets expiration win when the reservation has already elapsed", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(fixture.customer.id, [listingId], orderKey("expiration-wins"));
    await prisma.listing.update({
      where: { id: listingId },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });

    await Promise.allSettled([
      paymentsService.confirmPayment(created.id),
      listingsService.expireReservations(),
    ]);
    await listingsService.expireReservations();

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const order = await prisma.order.findUnique({ where: { id: created.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });

    expect(listing?.status).toBe("ACTIVE");
    expect(listing?.reservedAt).toBeNull();
    expect(listing?.reservationExpiresAt).toBeNull();
    expect(order?.paymentStatus).toBe("PENDING");
    expect(order?.status).toBe("CANCELLED");
    expect(txns).toHaveLength(0);
  });

  it("does not create two seller transactions for concurrent payment confirmations", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(fixture.customer.id, [listingId], orderKey("double-confirm"));

    const results = await Promise.allSettled([
      paymentsService.confirmPayment(created.id),
      paymentsService.confirmPayment(created.id),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    const order = await prisma.order.findUnique({ where: { id: created.id } });
    const txns = await prisma.sellerTransaction.findMany({ where: { orderId: created.id } });
    const seller = await prisma.seller.findUnique({ where: { id: fixture.seller.id } });

    expect(listing?.status).toBe("SOLD");
    expect(order?.paymentStatus).toBe("PAID");
    expect(txns).toHaveLength(1);
    expect(seller?.balance.toString()).toBe("90");
  });
});
