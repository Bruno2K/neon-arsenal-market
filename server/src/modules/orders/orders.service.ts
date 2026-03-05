import { prisma } from "../../shared/database/index.js";
import { ordersRepository } from "./orders.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateOrderInput, UpdateOrderTrackingInput } from "./orders.dto.js";
import type { Decimal } from "@prisma/client/runtime/library";

export const ordersService = {
  async create(customerId: string, input: CreateOrderInput) {
    const listingIds = input.items.map((i) => i.listingId);
    const listings = await prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: {
        id: true,
        sellerId: true,
        price: true,
        status: true,
        tradeLockUntil: true,
        product: { select: { weapon: true, skinName: true } },
      },
    });
    const listingMap = new Map(listings.map((l) => [l.id, l]));

    const orderItems: Array<{
      listingId: string;
      sellerId: string;
      priceSnapshot: Decimal;
    }> = [];
    let totalAmount = 0;

    for (const item of input.items) {
      const listing = listingMap.get(item.listingId);
      if (!listing) throw new AppError(404, `Listing not found: ${item.listingId}`);

      // Validate listing is available
      if (listing.status !== "ACTIVE") {
        throw new AppError(400, `Listing ${item.listingId} is not available (status: ${listing.status})`);
      }

      // Validate trade lock
      if (listing.tradeLockUntil && new Date(listing.tradeLockUntil) > new Date()) {
        throw new AppError(400, `Listing ${item.listingId} is trade locked until ${listing.tradeLockUntil}`);
      }

      const priceSnapshot = listing.price;
      totalAmount += Number(priceSnapshot);
      orderItems.push({
        listingId: listing.id,
        sellerId: listing.sellerId,
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
        // Reserve the listing
        await tx.listing.update({
          where: { id: item.listingId },
          data: { status: "RESERVED" },
        });

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            listingId: item.listingId,
            sellerId: item.sellerId,
            priceSnapshot: item.priceSnapshot,
          },
        });
      }

      return order;
    });

    const order = await ordersRepository.findById(result.id);
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
    return prisma.order.update({
      where: { id: orderId },
      data: { status: status as "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED" },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            listing: {
              include: {
                product: { select: { id: true, weapon: true, skinName: true, exterior: true } },
              },
            },
            seller: { select: { id: true, storeName: true } },
          },
        },
      },
    });
  },

  async updateTracking(orderId: string, userId: string, role: string, input: UpdateOrderTrackingInput) {
    const order = await ordersRepository.findById(orderId);
    if (!order) throw new AppError(404, "Order not found");
    if (role === "SELLER") {
      const seller = await prisma.seller.findUnique({ where: { userId } });
      if (!seller) throw new AppError(403, "Forbidden");
      const hasSellerItem = order.items.some((i: { sellerId: string }) => i.sellerId === seller.id);
      if (!hasSellerItem) throw new AppError(403, "Not your order");
    }
    const data: { trackingCode?: string | null; trackingCarrier?: string | null } = {};
    if (input.trackingCode !== undefined) data.trackingCode = input.trackingCode || null;
    if (input.trackingCarrier !== undefined) data.trackingCarrier = input.trackingCarrier || null;
    return prisma.order.update({
      where: { id: orderId },
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            listing: {
              include: {
                product: { select: { id: true, weapon: true, skinName: true, exterior: true } },
              },
            },
            seller: { select: { id: true, storeName: true } },
          },
        },
      },
    });
  },
};
