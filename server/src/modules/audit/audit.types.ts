import type { Prisma, UserRole } from "@prisma/client";

export const AUDIT_RETENTION_DAYS = 365;

export const AuditAction = {
  SELLER_APPROVAL_CHANGED: "SELLER_APPROVAL_CHANGED",
  LISTING_PRICE_CHANGE: "LISTING_PRICE_CHANGE",
  LISTING_CANCEL: "LISTING_CANCEL",
  ORDER_STATUS_CHANGE: "ORDER_STATUS_CHANGE",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditResourceType = {
  Seller: "Seller",
  Listing: "Listing",
  Order: "Order",
} as const;

export type AuditResourceTypeName = (typeof AuditResourceType)[keyof typeof AuditResourceType];

export type AuditActor = {
  actorId?: string | null;
  actorRole?: UserRole | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type AuditWriteInput = AuditActor & {
  action: string;
  resourceType: string;
  resourceId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

export type AuditClient = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
};
