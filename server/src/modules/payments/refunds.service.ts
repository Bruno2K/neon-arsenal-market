import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { MONEY_PRICE_SCALE } from "../../shared/money/policy.js";
import { computeSellerLedgerCompensation } from "../../shared/money/sellerLedger.js";

export type CreateRefundObligationInput = {
  orderId: string;
  providerCaptureId: string;
  amount: Prisma.Decimal;
};

export type RecordProviderConfirmedRefundInput = {
  refundId: string;
  providerRefundId: string;
};

/** Local refund persistence only. TASK-0013 deliberately performs no PayPal I/O. */
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

      const compensatedSellers = await appendCompletedRefundCompensation(tx, existing.id);
      return { refund: resolved, compensatedSellers };
    });
  },
};

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
