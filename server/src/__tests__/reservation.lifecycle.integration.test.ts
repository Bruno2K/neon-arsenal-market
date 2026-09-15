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

  it(
    "AUD-001: racing cancel against a concurrent payment confirmation never produces a paid " +
      "order with a canceled listing, or a sold listing whose order never reached PAID",
    async () => {
      // listingsService.cancel and paymentsService.confirmPayment guard the same listing row
      // with mutually exclusive conditional updates (payment: status=RESERVED -> SOLD; cancel:
      // status!=SOLD -> CANCELED) inside their own transactions. Real PostgreSQL row-level
      // locking serializes the two UPDATEs on that row: whichever commits first determines the
      // outcome, and the loser's WHERE clause is re-evaluated against the committed value and
      // matches nothing. Both orderings are legal; this test proves the invariant holds for
      // either one instead of asserting a chosen winner. Several independent trials (fresh
      // listing/order each time) exercise the genuine race without forcing an interleaving.
      const TRIALS = 6;
      for (let trial = 0; trial < TRIALS; trial += 1) {
        const fixture = await createCheckoutGraph();
        const listingId = fixture.listings[0].id;
        const created = await createOrder(
          fixture.customer.id,
          [listingId],
          orderKey(`cancel-vs-confirm-${trial}`)
        );

        const [confirmResult, cancelResult] = await Promise.allSettled([
          paymentsService.confirmPayment(created.id),
          listingsService.cancel(listingId, fixture.sellerUser.id, "SELLER"),
        ]);

        const listing = await prisma.listing.findUnique({ where: { id: listingId } });
        const order = await prisma.order.findUnique({ where: { id: created.id } });

        // The forbidden state (INV-LISTING-SOLD-IRREVERSIBLE), independent of which
        // branch below actually executed on this trial:
        expect(listing?.status === "CANCELED" && order?.paymentStatus === "PAID").toBe(false);
        expect(listing?.status === "SOLD" && order?.paymentStatus !== "PAID").toBe(false);

        if (listing?.status === "SOLD") {
          // Payment committed first: order is PAID/CONFIRMED in the same transaction as
          // the SOLD write, and cancel's guarded updateMany then observes status=SOLD and
          // rejects with the existing irreversibility error.
          expect(order?.paymentStatus).toBe("PAID");
          expect(order?.status).toBe("CONFIRMED");
          expect(confirmResult).toMatchObject({ status: "fulfilled", value: true });
          expect(cancelResult.status).toBe("rejected");
          if (cancelResult.status === "rejected") {
            expect(cancelResult.reason).toMatchObject({
              statusCode: 400,
              message: "Cannot cancel a SOLD listing",
            });
          }
        } else {
          // Cancel committed first: the listing is CANCELED, so payment's conditional
          // status=RESERVED listing update matches nothing. That mismatch throws inside
          // payment's own transaction, rolling back its own order claim -- the same 409
          // "reservation expired or no longer reserved" failure already proven above for
          // the expiry race -- rather than ever leaving a PAID order behind.
          expect(listing?.status).toBe("CANCELED");
          expect(order?.paymentStatus).toBe("PENDING");
          expect(order?.status).toBe("PENDING");
          expect(cancelResult.status).toBe("fulfilled");
          expect(confirmResult.status).toBe("rejected");
          if (confirmResult.status === "rejected") {
            expect(confirmResult.reason).toMatchObject({
              statusCode: 409,
              message: "Reservation expired or listing is no longer reserved",
            });
          }
        }
      }
    }
  );

  it("rejects cancelling a listing that a payment confirmed moments earlier", async () => {
    const fixture = await createCheckoutGraph();
    const listingId = fixture.listings[0].id;
    const created = await createOrder(fixture.customer.id, [listingId], orderKey("cancel-after-confirm"));

    await paymentsService.confirmPayment(created.id);

    await expect(
      listingsService.cancel(listingId, fixture.sellerUser.id, "SELLER")
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot cancel a SOLD listing",
    });

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    expect(listing?.status).toBe("SOLD");
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
