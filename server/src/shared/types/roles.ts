/**
 * Domain role and lifecycle values. PostgreSQL enums (Prisma) are the source of
 * truth. These tuples stay aligned with `@prisma/client` so Zod `z.enum()` can
 * share the same labels the database enforces.
 */
import {
  ClaimStatus,
  ListingStatus as PrismaListingStatus,
  OrderStatus as PrismaOrderStatus,
  PaymentProvider,
  PaymentStatus as PrismaPaymentStatus,
  UserRole,
  WebhookEventStatus,
} from "@prisma/client";

export { ClaimStatus, PaymentProvider, UserRole, WebhookEventStatus };

export const ROLES = [UserRole.ADMIN, UserRole.SELLER, UserRole.CUSTOMER] as const;
export type Role = UserRole;

/** Roles allowed at self-registration (ADMIN is seed-only). */
export const REGISTRATION_ROLES = [UserRole.CUSTOMER, UserRole.SELLER] as const;
export type RegistrationRole = (typeof REGISTRATION_ROLES)[number];

export const ORDER_STATUSES = [
  PrismaOrderStatus.PENDING,
  PrismaOrderStatus.CONFIRMED,
  PrismaOrderStatus.SHIPPED,
  PrismaOrderStatus.DELIVERED,
  PrismaOrderStatus.CANCELLED,
] as const;
export type OrderStatus = PrismaOrderStatus;

export const PAYMENT_STATUSES = [
  PrismaPaymentStatus.PENDING,
  PrismaPaymentStatus.PAID,
  PrismaPaymentStatus.REFUNDED,
] as const;
export type PaymentStatus = PrismaPaymentStatus;

export const LISTING_STATUSES = [
  PrismaListingStatus.ACTIVE,
  PrismaListingStatus.SOLD,
  PrismaListingStatus.RESERVED,
  PrismaListingStatus.CANCELED,
] as const;
export type ListingStatus = PrismaListingStatus;

export const TRANSACTION_STATUSES = PAYMENT_STATUSES;
export type TransactionStatus = PaymentStatus;

export const CLAIM_STATUSES = [ClaimStatus.IN_PROGRESS, ClaimStatus.COMPLETED] as const;
export type DurableClaimStatus = ClaimStatus;

export const WEBHOOK_EVENT_STATUSES = [
  WebhookEventStatus.RECEIVED,
  WebhookEventStatus.PROCESSED,
  WebhookEventStatus.IGNORED,
  WebhookEventStatus.FAILED,
] as const;

export const PAYMENT_PROVIDERS = [PaymentProvider.PAYPAL] as const;
