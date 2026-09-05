import { describe, expect, it } from "vitest";
import {
  ClaimStatus,
  ListingStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  UserRole,
  WebhookEventStatus,
} from "@prisma/client";
import { registerDto } from "../../../modules/auth/auth.dto.js";
import { listListingsQueryDto } from "../../../modules/listings/listings.dto.js";
import { listOrdersQueryDto, updateOrderStatusDto } from "../../../modules/orders/orders.dto.js";
import {
  CLAIM_STATUSES,
  LISTING_STATUSES,
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  REGISTRATION_ROLES,
  ROLES,
  WEBHOOK_EVENT_STATUSES,
} from "../roles.js";

function labelsOf(enumObject: Record<string, string>) {
  return Object.values(enumObject).sort();
}

describe("Prisma domain enums", () => {
  it("keeps TypeScript tuples aligned with generated Prisma enums", () => {
    expect([...ROLES].sort()).toEqual(labelsOf(UserRole));
    expect([...ORDER_STATUSES].sort()).toEqual(labelsOf(OrderStatus));
    expect([...PAYMENT_STATUSES].sort()).toEqual(labelsOf(PaymentStatus));
    expect([...LISTING_STATUSES].sort()).toEqual(labelsOf(ListingStatus));
    expect([...CLAIM_STATUSES].sort()).toEqual(labelsOf(ClaimStatus));
    expect([...WEBHOOK_EVENT_STATUSES].sort()).toEqual(labelsOf(WebhookEventStatus));
    expect([...PAYMENT_PROVIDERS].sort()).toEqual(labelsOf(PaymentProvider));
  });

  it("preserves listing CANCELED vs order CANCELLED spellings", () => {
    expect(LISTING_STATUSES).toContain("CANCELED");
    expect(LISTING_STATUSES).not.toContain("CANCELLED");
    expect(ORDER_STATUSES).toContain("CANCELLED");
    expect(ORDER_STATUSES).not.toContain("CANCELED");
  });

  it("does not allow ADMIN at self-registration", () => {
    expect(REGISTRATION_ROLES).toEqual(["CUSTOMER", "SELLER"]);
    expect(registerDto.safeParse({ name: "A", email: "a@test.local", password: "secret1", role: "ADMIN" }).success).toBe(
      false
    );
  });

  it("rejects invalid lifecycle labels in HTTP DTOs", () => {
    expect(updateOrderStatusDto.safeParse({ status: "CANCELED" }).success).toBe(false);
    expect(listOrdersQueryDto.safeParse({ status: "UNKNOWN" }).success).toBe(false);
    expect(listOrdersQueryDto.safeParse({ paymentStatus: "CAPTURED" }).success).toBe(false);
    expect(listListingsQueryDto.safeParse({ status: "CANCELLED" }).success).toBe(false);
  });
});
