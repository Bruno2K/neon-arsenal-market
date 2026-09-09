import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { MONEY_PRICE_SCALE } from "../../shared/money/policy.js";

export type CreateRefundObligationInput = {
  orderId: string;
  providerCaptureId: string;
  amount: Prisma.Decimal;
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
};
