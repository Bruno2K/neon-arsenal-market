import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
  createPayPalOrder,
  getPayPalApprovalLink,
} from "../../shared/utils/paypal.js";
import type { CreatePaymentInput } from "./payments.dto.js";

export const paymentsService = {
  async createPaymentLink(userId: string, input: CreatePaymentInput) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order) throw new AppError(404, "Order not found");
    if (order.customerId !== userId) throw new AppError(403, "Not your order");
    if (order.paymentStatus === "PAID") throw new AppError(400, "Order already paid");

    const amount = Number(order.totalAmount).toFixed(2);
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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.paymentStatus === "PAID") return;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      });

      // Mark listings as SOLD
      for (const item of order.items) {
        await tx.listing.update({
          where: { id: item.listingId },
          data: { status: "SOLD", soldAt: new Date() },
        });
      }

      const bySeller = new Map<string, { grossAmount: number; commissionRate: number }>();
      for (const item of order.items) {
        const gross = Number(item.priceSnapshot);
        const seller = await tx.seller.findUnique({
          where: { id: item.sellerId },
          select: { commissionRate: true },
        });
        const rate = seller ? Number(seller.commissionRate) : 0;
        const existing = bySeller.get(item.sellerId);
        if (existing) {
          existing.grossAmount += gross;
        } else {
          bySeller.set(item.sellerId, { grossAmount: gross, commissionRate: rate });
        }
      }

      for (const [sellerId, data] of bySeller) {
        const commissionAmount = data.grossAmount * data.commissionRate;
        const netAmount = data.grossAmount - commissionAmount;
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
