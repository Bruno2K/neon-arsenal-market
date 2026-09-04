import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
  createPayPalOrder,
  getPayPalApprovalLink,
} from "../../shared/utils/paypal.js";
import type { CreatePaymentInput } from "./payments.dto.js";
import { Prisma } from "@prisma/client";

export const paymentsService = {
  async createPaymentLink(userId: string, input: CreatePaymentInput) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order) throw new AppError(404, "Order not found");
    if (order.customerId !== userId) throw new AppError(403, "Not your order");
    if (order.paymentStatus === "PAID") throw new AppError(400, "Order already paid");

    const amount = order.totalAmount.toFixed(2);
    const paypalOrder = await createPayPalOrder(amount, "BRL", order.id);
    const approvalLink = getPayPalApprovalLink(paypalOrder as { links?: Array<{ href?: string; rel?: string }> });
    if (!approvalLink) throw new AppError(500, "Failed to create PayPal order");

    await prisma.order.update({
      where: { id: order.id },
      data: { paypalOrderId: (paypalOrder as { id?: string }).id },
    });

    return {
      orderId: order.id,
      paypalOrderId: (paypalOrder as { id?: string }).id,
      approvalUrl: approvalLink,
    };
  },

  async handleWebhook(body: unknown) {
    const event = body as {
      event_type?: string;
      resource?: { id?: string; purchase_units?: Array<{ reference_id?: string }> };
    };
    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED" && event.event_type !== "CHECKOUT.ORDER.APPROVED") {
      return;
    }
    let orderId: string | null = null;
    if (event.resource?.purchase_units?.[0]?.reference_id) {
      orderId = event.resource.purchase_units[0].reference_id;
    }
    if (!orderId) {
      const paypalId = event.resource?.id;
      if (paypalId) {
        const order = await prisma.order.findFirst({
          where: { paypalOrderId: paypalId },
        });
        orderId = order?.id ?? null;
      }
    }
    if (!orderId) return;
    await this.confirmPayment(orderId);
  },

  async confirmPayment(orderId: string) {
    await prisma.$transaction(async (tx) => {
      // Claim the payment confirmation atomically. A repeated/concurrent webhook
      // sees count = 0 and exits without issuing another seller payout.
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: "PENDING",
        },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      });

      if (claimed.count === 0) return;

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new AppError(404, "Order not found");

      const soldAt = new Date();
      await tx.listing.updateMany({
        where: {
          id: { in: order.items.map((item) => item.listingId) },
          status: "RESERVED",
        },
        data: { status: "SOLD", soldAt },
      });

      const bySeller = new Map<string, { grossAmount: Prisma.Decimal; commissionRate: Prisma.Decimal }>();
      for (const item of order.items) {
        const seller = await tx.seller.findUnique({
          where: { id: item.sellerId },
          select: { commissionRate: true },
        });
        if (!seller) throw new AppError(404, `Seller not found: ${item.sellerId}`);

        const existing = bySeller.get(item.sellerId);
        if (existing) {
          existing.grossAmount = existing.grossAmount.plus(item.priceSnapshot);
        } else {
          bySeller.set(item.sellerId, {
            grossAmount: item.priceSnapshot,
            commissionRate: seller.commissionRate,
          });
        }
      }

      for (const [sellerId, data] of bySeller) {
        const commissionAmount = data.grossAmount.mul(data.commissionRate);
        const netAmount = data.grossAmount.minus(commissionAmount);

        await tx.sellerTransaction.create({
          data: {
            sellerId,
            orderId,
            grossAmount: data.grossAmount,
            commissionAmount,
            netAmount,
            status: "PAID",
          },
        });

        await tx.seller.update({
          where: { id: sellerId },
          data: { balance: { increment: netAmount } },
        });
      }
    });
  },
};
