import { prisma } from "../../shared/database/index.js";
import type { OrderStatus, PaymentStatus } from "../../shared/types/roles.js";
import type { Decimal } from "@prisma/client/runtime/library";

export const ordersRepository = {
  async createWithItems(params: {
    customerId: string;
    totalAmount: Decimal;
    items: Array<{ productId: string; sellerId: string; quantity: number; priceSnapshot: Decimal }>;
  }) {
    const { customerId, totalAmount, items } = params;
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId,
          totalAmount,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
      });
      await tx.orderItem.createMany({
        data: items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity,
          priceSnapshot: item.priceSnapshot,
        })),
      });
      return order;
    });
  },

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            seller: { select: { id: true, storeName: true } },
          },
        },
      },
    });
  },

  async findManyByCustomerId(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            seller: { select: { id: true, storeName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findManyBySellerId(sellerId: string) {
    return prisma.order.findMany({
      where: { items: { some: { sellerId } } },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          where: { sellerId },
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findMany(filters?: { status?: OrderStatus; paymentStatus?: PaymentStatus }) {
    return prisma.order.findMany({
      where: filters,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            seller: { select: { id: true, storeName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
    return prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus, status: paymentStatus === "PAID" ? "CONFIRMED" : undefined },
    });
  },

  async getOrderWithItems(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
  },
};
