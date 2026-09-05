import { describe, expect, it } from "vitest";
import type { OrderStatus } from "../../../shared/types/roles.js";
import {
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_TRANSITIONS_BY_ROLE,
  TERMINAL_ORDER_STATUSES,
  assertOrderStatusTransition,
  isAllowedOrderStatusTransition,
  isTerminalOrderStatus,
  parseOrderStatus,
} from "../order-status.js";

describe("order status machine", () => {
  it("allows the documented fulfillment graph", () => {
    expect(ORDER_STATUS_TRANSITIONS.PENDING).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(ORDER_STATUS_TRANSITIONS.CONFIRMED).toEqual(["SHIPPED", "CANCELLED"]);
    expect(ORDER_STATUS_TRANSITIONS.SHIPPED).toEqual(["DELIVERED"]);
    expect(isAllowedOrderStatusTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(isAllowedOrderStatusTransition("PENDING", "CANCELLED")).toBe(true);
    expect(isAllowedOrderStatusTransition("CONFIRMED", "SHIPPED")).toBe(true);
    expect(isAllowedOrderStatusTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(isAllowedOrderStatusTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("treats DELIVERED and CANCELLED as terminal", () => {
    expect(TERMINAL_ORDER_STATUSES).toEqual(["DELIVERED", "CANCELLED"]);
    expect(isTerminalOrderStatus("DELIVERED")).toBe(true);
    expect(isTerminalOrderStatus("CANCELLED")).toBe(true);
    expect(ORDER_STATUS_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ORDER_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it.each([
    ["PENDING", "SHIPPED"],
    ["PENDING", "DELIVERED"],
    ["PENDING", "PENDING"],
    ["CONFIRMED", "PENDING"],
    ["CONFIRMED", "DELIVERED"],
    ["SHIPPED", "CANCELLED"],
    ["SHIPPED", "CONFIRMED"],
    ["DELIVERED", "CANCELLED"],
    ["DELIVERED", "SHIPPED"],
    ["CANCELLED", "PENDING"],
    ["CANCELLED", "CONFIRMED"],
  ] as const)("rejects %s → %s", (from, to) => {
    expect(isAllowedOrderStatusTransition(from, to)).toBe(false);
    try {
      assertOrderStatusTransition(from, to, "ADMIN");
      throw new Error("expected transition to throw");
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        message: `Invalid status transition from ${from} to ${to}`,
      });
    }
  });

  it("ADMIN may apply every graph edge", () => {
    (Object.entries(ORDER_STATUS_TRANSITIONS) as Array<[OrderStatus, readonly OrderStatus[]]>).forEach(
      ([from, targets]) => {
        for (const to of targets) {
          expect(() => assertOrderStatusTransition(from, to, "ADMIN")).not.toThrow();
          expect(ORDER_STATUS_TRANSITIONS_BY_ROLE.ADMIN[from]).toContain(to);
        }
      }
    );
  });

  it("CUSTOMER may cancel PENDING or CONFIRMED and confirm SHIPPED → DELIVERED", () => {
    expect(() => assertOrderStatusTransition("PENDING", "CANCELLED", "CUSTOMER")).not.toThrow();
    expect(() => assertOrderStatusTransition("CONFIRMED", "CANCELLED", "CUSTOMER")).not.toThrow();
    expect(() => assertOrderStatusTransition("SHIPPED", "DELIVERED", "CUSTOMER")).not.toThrow();
  });

  it("CUSTOMER cannot skip payment or fulfill shipment", () => {
    try {
      assertOrderStatusTransition("PENDING", "CONFIRMED", "CUSTOMER");
      throw new Error("expected CUSTOMER PENDING→CONFIRMED to throw");
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 403,
        message: "Role CUSTOMER cannot transition order from PENDING to CONFIRMED",
      });
    }
    try {
      assertOrderStatusTransition("CONFIRMED", "SHIPPED", "CUSTOMER");
      throw new Error("expected CUSTOMER CONFIRMED→SHIPPED to throw");
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 403,
        message: "Role CUSTOMER cannot transition order from CONFIRMED to SHIPPED",
      });
    }
  });

  it("SELLER cannot apply any fulfillment transition", () => {
    try {
      assertOrderStatusTransition("PENDING", "CANCELLED", "SELLER");
      throw new Error("expected SELLER to throw");
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 403, message: "Sellers cannot edit orders" });
    }
    try {
      assertOrderStatusTransition("CONFIRMED", "SHIPPED", "SELLER");
      throw new Error("expected SELLER to throw");
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 403, message: "Sellers cannot edit orders" });
    }
  });

  it("rejects unknown stored statuses", () => {
    try {
      parseOrderStatus("REFUNDED");
      throw new Error("expected unknown status to throw");
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 400, message: "Unknown order status: REFUNDED" });
    }
  });
});
