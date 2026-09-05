import { describe, expect, it } from "vitest";
import type { Order } from "@/types/api";
import {
  canRetryPayment,
  formatReservationCountdown,
  isOrderAccessError,
  isPaymentConfirmed,
  orderPageIntent,
  orderPollIntervalMs,
  ORDER_POLL_INTERVAL_MS,
} from "../orderPaymentView";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    totalAmount: 105,
    status: "PENDING",
    paymentStatus: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "item-1",
        listingId: "listing-ak",
        sellerId: "seller-1",
        priceSnapshot: 100,
        listing: {
          id: "listing-ak",
          reservationExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          product: {
            id: "prod-1",
            weapon: "AK-47",
            skinName: "Redline",
            exterior: "Field-Tested",
          },
        },
      },
    ],
    ...overrides,
  };
}

describe("orderPaymentView", () => {
  it("treats only PAID as locally displayable confirmation", () => {
    expect(isPaymentConfirmed(order({ paymentStatus: "PAID" }))).toBe(true);
    expect(isPaymentConfirmed(order({ paymentStatus: "PENDING" }))).toBe(false);
    expect(isPaymentConfirmed(order({ paymentStatus: "REFUNDED" }))).toBe(
      false,
    );
  });

  it("detects return/cancel/view intents from the path", () => {
    expect(orderPageIntent("/orders/abc/return")).toBe("return");
    expect(orderPageIntent("/orders/abc/cancel")).toBe("cancel");
    expect(orderPageIntent("/orders/abc")).toBe("view");
  });

  it("allows retry only while payment is PENDING and the reservation is live", () => {
    const now = Date.parse("2026-09-05T12:00:00.000Z");
    const live = order({
      items: [
        {
          id: "item-1",
          listingId: "listing-ak",
          sellerId: "seller-1",
          priceSnapshot: 100,
          listing: {
            id: "listing-ak",
            reservationExpiresAt: "2026-09-05T12:10:00.000Z",
            product: {
              id: "prod-1",
              weapon: "AK-47",
              skinName: "Redline",
              exterior: "Field-Tested",
            },
          },
        },
      ],
    });
    expect(canRetryPayment(live, now)).toBe(true);
    expect(canRetryPayment({ ...live, paymentStatus: "PAID" }, now)).toBe(
      false,
    );
    expect(canRetryPayment({ ...live, status: "CANCELLED" }, now)).toBe(false);
    expect(
      canRetryPayment(
        {
          ...live,
          items: [
            {
              ...live.items![0],
              listing: {
                ...live.items![0].listing!,
                reservationExpiresAt: "2026-09-05T11:59:00.000Z",
              },
            },
          ],
        },
        now,
      ),
    ).toBe(false);
  });

  it("formats remaining reservation time as mm:ss", () => {
    const now = Date.parse("2026-09-05T12:00:00.000Z");
    expect(
      formatReservationCountdown(Date.parse("2026-09-05T12:05:07.000Z"), now),
    ).toBe("05:07");
    expect(
      formatReservationCountdown(Date.parse("2026-09-05T11:59:00.000Z"), now),
    ).toBe("00:00");
  });

  it("polls only pending unpaid return/view orders", () => {
    expect(orderPollIntervalMs(order(), "return")).toBe(ORDER_POLL_INTERVAL_MS);
    expect(orderPollIntervalMs(order(), "view")).toBe(ORDER_POLL_INTERVAL_MS);
    expect(orderPollIntervalMs(order(), "cancel")).toBe(false);
    expect(
      orderPollIntervalMs(order({ paymentStatus: "PAID" }), "return"),
    ).toBe(false);
  });

  it("maps 403/404 order errors to an access failure", () => {
    expect(isOrderAccessError(new Error("Order not found"))).toBe(true);
    expect(isOrderAccessError(new Error("Not your order"))).toBe(true);
    expect(isOrderAccessError(new Error("Request failed: 403"))).toBe(true);
    expect(isOrderAccessError(new Error("Falha de rede"))).toBe(false);
  });
});
