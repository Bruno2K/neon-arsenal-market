import { prisma } from "../../shared/database/index.js";
import { ordersRepository } from "./orders.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { emailService } from "../../shared/utils/email.js";
import type { CreateOrderInput } from "./orders.dto.js";
import type { Decimal } from "@prisma/client/runtime/library";

export const ordersService = {
  async create(customerId: string, input: CreateOrderInput) {
    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, sellerId: true, price: true, stock: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const orderItems: Array<{
      productId: string;
      sellerId: string;
      quantity: number;
      priceSnapshot: Decimal;
    }> = [];
    let totalAmount = 0;

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new AppError(404, `Product not found: ${item.productId}`);
      if (product.stock < item.quantity)
        throw new AppError(400, `Insufficient stock for ${product.name}. Available: ${product.stock}`);
      const priceSnapshot = product.price;
      const itemTotal = Number(priceSnapshot) * item.quantity;
      totalAmount += itemTotal;
      orderItems.push({
        productId: product.id,
        sellerId: product.sellerId,
        quantity: item.quantity,
        priceSnapshot,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId,
          totalAmount,
          status: "PENDING",
          paymentStatus: "PENDING",
        },
      });

      for (const item of orderItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            sellerId: item.sellerId,
            quantity: item.quantity,
            priceSnapshot: item.priceSnapshot,
          },
        });
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new AppError(409, "Insufficient stock (concurrent update). Please retry.");
        }
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: "OUT",
            quantity: item.quantity,
            referenceId: order.id,
          },
        });
      }

      return order;
    });

    const order = await ordersRepository.findById(result.id);

    // Fire-and-forget: send confirmation email (non-blocking)
    const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { email: true } });
    if (customer?.email) {
      emailService.sendOrderConfirmation({
        to: customer.email,
        orderId: result.id,
        totalAmount,
      }).catch((err) => console.error("[EmailService] sendOrderConfirmation failed:", err));
    }

    return { ...order!, totalAmount };
  },

  async getById(orderId: string, userId: string, role: string) {
    const order = await ordersRepository.findById(orderId);
    if (!order) throw new AppError(404, "Order not found");
    if (role === "CUSTOMER" && order.customer.id !== userId)
      throw new AppError(403, "Not your order");
    if (role === "SELLER") {
      const seller = await prisma.seller.findUnique({ where: { userId } });
      if (!seller) throw new AppError(403, "Not your order");
      const hasSellerItem = order.items.some((i: { sellerId: string }) => i.sellerId === seller.id);
      if (!hasSellerItem) throw new AppError(403, "Not your order");
    }
    return order;
  },

  async listByCustomer(customerId: string) {
    return ordersRepository.findManyByCustomerId(customerId);
  },

  async listBySeller(userId: string) {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new AppError(404, "Seller not found");
    return ordersRepository.findManyBySellerId(seller.id);
  },

  async listAdmin(filters?: { status?: string; paymentStatus?: string }) {
    return ordersRepository.findMany(
      filters as Parameters<typeof ordersRepository.findMany>[0]
    );
  },

  async updateStatus(orderId: string, userId: string, role: string, status: string) {
    const order = await ordersRepository.findById(orderId);
    if (!order) throw new AppError(404, "Order not found");
    if (role === "SELLER") throw new AppError(403, "Sellers cannot edit orders");
    if (role === "CUSTOMER" && order.customer.id !== userId)
      throw new AppError(403, "Not your order");
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: status as "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED" },
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

    // Fire-and-forget: notify customer when shipped
    if (status === "SHIPPED" && updated.customer.email) {
      emailService.sendOrderShipped({
        to: updated.customer.email,
        orderId,
      }).catch((err) => console.error("[EmailService] sendOrderShipped failed:", err));
    }

    return updated;
  },
};
