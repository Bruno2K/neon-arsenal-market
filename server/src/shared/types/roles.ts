/** Role values stored in DB (SQLite uses String instead of enum) */
export type Role = "ADMIN" | "SELLER" | "CUSTOMER";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";
