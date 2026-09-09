import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { MONEY_PRICE_SCALE } from "../../shared/money/policy.js";
import { computeSellerLedgerCompensation } from "../../shared/money/sellerLedger.js";
import {
  refundPayPalCapture,
  type PayPalRefundStatus,
} from "../../shared/utils/paypal.js";

export type CreateRefundObligationInput = {
  orderId: string;
  providerCaptureId: string;
  amount: Prisma.Decimal;
};

export type RecordProviderConfirmedRefundInput = {
  refundId: string;
  providerRefundId: string;
};

export type RecordProviderRefundObservationInput = RecordProviderConfirmedRefundInput & {
  status: Exclude<PayPalRefundStatus, "COMPLETED">;
};

export const refundsService = {
  async createObligation(input: CreateRefundObligationInput) {
    if (!input.providerCaptureId.trim()) {
      throw new AppError(400, "Provider capture id is required");
    }
    if (!input.amount.isPositive() || input.amount.decimalPlaces() > MONEY_PRICE_SCALE) {
      throw new AppError(400, "Refund amount must be a positive full BRL amount");
    }

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, totalAmount: true },
    });
    if (!order) throw new AppError(404, "Order not found");
    if (!order.totalAmount.equals(input.amount)) {
      throw new AppError(409, "Refund obligation must equal the full order amount");
    }

    const refund = await prisma.refund.upsert({
      where: {
        provider_providerCaptureId: {
          provider: "PAYPAL",
          providerCaptureId: input.providerCaptureId,
        },
      },
      create: {
        orderId: input.orderId,
        provider: "PAYPAL",
        providerCaptureId: input.providerCaptureId,
        amount: input.amount,
        reason: "UNFULFILLABLE_CAPTURE",
      },
      update: {},
    });

    if (
      refund.orderId !== input.orderId ||
      !refund.amount.equals(input.amount) ||
      refund.reason !== "UNFULFILLABLE_CAPTURE"
    ) {
      throw new AppError(409, "Provider capture already belongs to another refund obligation");
    }
    return refund;
  },

  /**
   * Persist already-trusted provider completion and its local financial effect.
   * This method performs no provider I/O. Refund state, compensating movements,
   * and Seller.balance projections commit or roll back together.
   */
  async recordProviderConfirmedCompletion(input: RecordProviderConfirmedRefundInput) {
    if (!input.providerRefundId.trim()) {
      throw new AppError(400, "Provider refund id is required");
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.refund.findUnique({ where: { id: input.refundId } });
      if (!existing) throw new AppError(404, "Refund obligation not found");
      if (existing.providerRefundId && existing.providerRefundId !== input.providerRefundId) {
        throw new AppError(409, "Refund already has another provider identity");
      }

      await tx.refund.updateMany({
        where: { id: existing.id, status: { not: "COMPLETED" } },
        data: {
          providerRefundId: input.providerRefundId,
          status: "COMPLETED",
          completedAt: new Date(),
          failureReason: null,
        },
      });

      const resolved = await tx.refund.findUniqueOrThrow({ where: { id: existing.id } });
      if (resolved.providerRefundId !== input.providerRefundId) {
        throw new AppError(409, "Refund is already completed with another provider identity");
      }

      await tx.order.update({
        where: { id: resolved.orderId },
        data: { paymentStatus: "REFUNDED" },
      });
      const compensatedSellers = await appendCompletedRefundCompensation(tx, existing.id);
      return { refund: resolved, compensatedSellers };
    });
  },

  /**
   * Persists a trusted non-completed provider result without allowing stale or
   * out-of-order observations to downgrade an already completed refund.
   */
  async recordProviderObservation(input: RecordProviderRefundObservationInput) {
    if (!input.providerRefundId.trim()) {
      throw new AppError(400, "Provider refund id is required");
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.refund.findUnique({ where: { id: input.refundId } });
      if (!existing) throw new AppError(404, "Refund obligation not found");
      if (existing.providerRefundId && existing.providerRefundId !== input.providerRefundId) {
        throw new AppError(409, "Refund already has another provider identity");
      }
      if (existing.status === "COMPLETED") return existing;

      const failed = input.status === "FAILED" || input.status === "CANCELLED";
      await tx.refund.updateMany({
        where: { id: existing.id, status: { not: "COMPLETED" } },
        data: {
          providerRefundId: input.providerRefundId,
          status: failed ? "FAILED" : "PROCESSING",
          failureReason: failed ? `paypal_refund_${input.status.toLowerCase()}` : null,
        },
      });
      return tx.refund.findUniqueOrThrow({ where: { id: existing.id } });
    });
  },

  /**
   * Claims and performs one idempotent provider attempt. The PostgreSQL claim
   * commits before PayPal I/O. PROCESSING is intentionally replayable because
   * it can mean the provider succeeded before this process persisted the result.
   */
  async executeProviderRefund(refundId: string) {
    await prisma.refund.updateMany({
      where: { id: refundId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PROCESSING", failureReason: null },
    });

    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new AppError(404, "Refund obligation not found");
    if (refund.status === "COMPLETED") {
      return { refund, compensatedSellers: 0, requestId: buildPayPalRefundRequestId(refund.id) };
    }
    if (refund.provider !== "PAYPAL") {
      throw new AppError(409, "Refund provider is not supported");
    }

    const requestId = buildPayPalRefundRequestId(refund.id);
    const providerResult = await refundPayPalCapture(
      refund.providerCaptureId,
      requestId
    );

    if (providerResult.status === "COMPLETED") {
      const completed = await refundsService.recordProviderConfirmedCompletion({
        refundId: refund.id,
        providerRefundId: providerResult.id,
      });
      return { ...completed, requestId };
    }

    const observed = await refundsService.recordProviderObservation({
      refundId: refund.id,
      providerRefundId: providerResult.id,
      status: providerResult.status,
    });
    return { refund: observed, compensatedSellers: 0, requestId };
  },
};

/** Stable 36-character key derived only from the durable local refund identity. */
export function buildPayPalRefundRequestId(refundId: string): string {
  if (!refundId.trim()) throw new AppError(400, "Refund id is required");
  const digest = createHash("sha256")
    .update(`neon-paypal-capture-refund:${refundId}`)
    .digest("hex")
    .slice(0, 32);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}

/**
 * Transaction-scoped compensation primitive for TASK-0014 composition.
 * It refuses every pre-completion state, even if called directly. The caller
 * must transition trusted provider evidence to COMPLETED in this same tx.
 */
export async function appendCompletedRefundCompensation(
  tx: Prisma.TransactionClient,
  refundId: string
): Promise<number> {
  const refund = await tx.refund.findFirst({
    where: { id: refundId, status: "COMPLETED" },
  });
  if (!refund) return 0;

  const credits = await tx.sellerTransaction.findMany({
    where: {
      orderId: refund.orderId,
      entryType: "PAYMENT_CREDIT",
      status: "PAID",
    },
  });

  let applied = 0;
  for (const credit of credits) {
    const amounts = computeSellerLedgerCompensation(credit);
    const inserted = await tx.sellerTransaction.createMany({
      data: [
        {
          sellerId: credit.sellerId,
          orderId: credit.orderId,
          refundId: refund.id,
          entryType: "REFUND_COMPENSATION",
          economicEventId: refund.id,
          ...amounts,
          status: "PAID",
        },
      ],
      skipDuplicates: true,
    });
    if (inserted.count === 0) continue;

    await tx.seller.update({
      where: { id: credit.sellerId },
      data: { balance: { increment: amounts.netAmount } },
    });
    applied += 1;
  }
  return applied;
}
