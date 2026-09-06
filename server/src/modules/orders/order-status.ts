import { AppError } from "../../shared/errors/AppError.js";
import { isOneOf } from "../../shared/types/guards.js";
import {
  isOrderStatus,
  isRole,
  type OrderStatus,
  type Role,
} from "../../shared/types/roles.js";

export { isOrderStatus };

/**
 * Fulfillment graph for Order.status.
 *
 * Payment confirmation still performs PENDING → CONFIRMED internally.
 * Reservation expiry still performs PENDING → CANCELLED internally.
 * PATCH /orders/:id/status must use this graph and the role subset below.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const TERMINAL_ORDER_STATUSES = ["DELIVERED", "CANCELLED"] as const;
export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

/**
 * HTTP PATCH role rules. ADMIN may apply any graph edge. CUSTOMER may cancel
 * an unpaid/unshipped order and confirm receipt after shipment. SELLER cannot
 * change fulfillment status (tracking uses PATCH /orders/:id/tracking).
 */
export const ORDER_STATUS_TRANSITIONS_BY_ROLE: Record<Role, Record<OrderStatus, readonly OrderStatus[]>> = {
  ADMIN: {
    PENDING: ORDER_STATUS_TRANSITIONS.PENDING,
    CONFIRMED: ORDER_STATUS_TRANSITIONS.CONFIRMED,
    SHIPPED: ORDER_STATUS_TRANSITIONS.SHIPPED,
    DELIVERED: ORDER_STATUS_TRANSITIONS.DELIVERED,
    CANCELLED: ORDER_STATUS_TRANSITIONS.CANCELLED,
  },
  CUSTOMER: {
    PENDING: ["CANCELLED"],
    CONFIRMED: ["CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  },
  SELLER: {
    PENDING: [],
    CONFIRMED: [],
    SHIPPED: [],
    DELIVERED: [],
    CANCELLED: [],
  },
};

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return isOneOf(status, TERMINAL_ORDER_STATUSES);
}

export function isAllowedOrderStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function parseOrderStatus(value: unknown): OrderStatus {
  if (!isOrderStatus(value)) {
    throw new AppError(400, `Unknown order status: ${String(value)}`);
  }
  return value;
}

export function assertOrderStatusTransition(from: OrderStatus, to: OrderStatus, role: string): void {
  if (!isAllowedOrderStatusTransition(from, to)) {
    throw new AppError(400, `Invalid status transition from ${from} to ${to}`);
  }

  if (role === "SELLER") {
    throw new AppError(403, "Sellers cannot edit orders");
  }

  if (!isRole(role)) {
    throw new AppError(403, "Forbidden");
  }

  const allowedForRole = ORDER_STATUS_TRANSITIONS_BY_ROLE[role][from];
  if (!allowedForRole.includes(to)) {
    throw new AppError(403, `Role ${role} cannot transition order from ${from} to ${to}`);
  }
}
