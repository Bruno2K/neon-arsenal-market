/**
 * Role values stored in DB as strings (SQLite does not support native enums).
 * The TypeScript union type + const tuple pattern gives compile-time safety
 * and is directly compatible with Zod's `z.enum()`.
 */

// ─── Role ─────────────────────────────────────────────────────────────────────

export const ROLES = ["ADMIN", "SELLER", "CUSTOMER"] as const;
export type Role = (typeof ROLES)[number];

/** Roles allowed at self-registration (ADMIN is seed-only). */
export const REGISTRATION_ROLES = ["CUSTOMER", "SELLER"] as const;
export type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

// ─── Order status ─────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ─── Payment status ───────────────────────────────────────────────────────────

export const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ─── Listing status ───────────────────────────────────────────────────────────

export const LISTING_STATUSES = ["ACTIVE", "SOLD", "RESERVED", "CANCELED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

// ─── Transaction status ───────────────────────────────────────────────────────

export const TRANSACTION_STATUSES = ["PENDING", "PAID", "REFUNDED"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
