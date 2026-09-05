import { prisma } from "../../shared/database/index.js";
import { ordersRepository } from "./orders.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { logger } from "../../shared/logger.js";
import { buildReservationWindow } from "../../shared/config/reservation.js";
import type { CreateOrderInput, UpdateOrderTrackingInput } from "./orders.dto.js";
import { fingerprintOrderCreate } from "./orders.idempotency.js";
import { Prisma } from "@prisma/client";

export const ordersService = {
  async create(
    customerId: string,
    input: CreateOrderInput,
    idempotencyKey: string,
    requestId?: string
  ) {
    const listingIds = input.items.map((i) => i.listingId);
    if (new Set(listingIds).size !== listingIds.length) {
      throw new AppError(400, "A listing can only appear once in an order");
    }

    const fingerprint = fingerprintOrderCreate(input);
    const logBase = { customerId, fingerprint, requestId };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Claim the (user, key) pair before reservation so concurrent identical
        // requests serialize on the unique index instead of racing listings.
        await tx.orderIdempotency.create({
          data: {
            userId: customerId,
            key: idempotencyKey,
            fingerprint,
            status: "PROCESSING",
          },
        });

        const orderItems: Array<{
          listingId: string;
          sellerId: string;
          priceSnapshot: Prisma.Decimal;
        }> = [];
        let totalAmount = new Prisma.Decimal(0);
        const reservation = buildReservationWindow();

        const order = await tx.order.create({
          data: {
            customerId,
            totalAmount,
            status: "PENDING",
            paymentStatus: "PENDING",
          },
        });

        for (const listingId of listingIds) {
          // The status transition is conditional, so two concurrent orders cannot
          // both reserve the same listing. PostgreSQL performs this atomically.
          const reserved = await tx.listing.updateMany({
            where: {
              id: listingId,
              status: "ACTIVE",
              OR: [
                { tradeLockUntil: null },
                { tradeLockUntil: { lte: new Date() } },
              ],
            },
            data: {
              status: "RESERVED",
              reservedAt: reservation.reservedAt,
              reservationExpiresAt: reservation.reservationExpiresAt,
              reservedByOrderId: order.id,
            },
          });

          if (reserved.count !== 1) {
            const listing = await tx.listing.findUnique({
              where: { id: listingId },
              select: { id: true, status: true, tradeLockUntil: true },
            });

            if (!listing) throw new AppError(404, `Listing not found: ${listingId}`);
            if (listing.tradeLockUntil && listing.tradeLockUntil > new Date()) {
              throw new AppError(400, `Listing ${listingId} is trade locked until ${listing.tradeLockUntil}`);
            }
            throw new AppError(400, `Listing ${listingId} is not available (status: ${listing.status})`);
          }

          const listing = await tx.listing.findUnique({
            where: { id: listingId },
            select: { id: true, sellerId: true, price: true },
          });

          if (!listing) {
            throw new AppError(404, `Listing not found: ${listingId}`);
          }

          totalAmount = totalAmount.plus(listing.price);
          orderItems.push({
            listingId: listing.id,
            sellerId: listing.sellerId,
            priceSnapshot: listing.price,
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { totalAmount },
        });

        await tx.orderItem.createMany({
          data: orderItems.map((item) => ({
            orderId: order.id,
            listingId: item.listingId,
            sellerId: item.sellerId,
            priceSnapshot: item.priceSnapshot,
          })),
        });

        await tx.orderIdempotency.update({
          where: { userId_key: { userId: customerId, key: idempotencyKey } },
          data: { status: "COMPLETED", orderId: order.id, completedAt: new Date() },
        });

        return { ...order, totalAmount };
      });

      logger.info({ ...logBase, orderId: result.id }, "order idempotency created");
      const order = await ordersRepository.findById(result.id);
      return { ...order!, totalAmount: result.totalAmount };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return replayCompletedOrder(customerId, idempotencyKey, fingerprint, requestId);
      }
      logger.warn(
        {
          ...logBase,
          err: err instanceof Error ? err.message : "unknown",
        },
        "order idempotency failed"
      );
      throw err;
    }
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

async function replayCompletedOrder(
  customerId: string,
  idempotencyKey: string,
  fingerprint: string,
  requestId?: string
) {
  const logBase = { customerId, fingerprint, requestId };
  const existing = await prisma.orderIdempotency.findUnique({
    where: { userId_key: { userId: customerId, key: idempotencyKey } },
  });

  if (!existing) {
    logger.warn(logBase, "order idempotency unique conflict without a row");
    throw new AppError(409, "Idempotency-Key conflict");
  }

  if (existing.fingerprint !== fingerprint) {
    logger.info(logBase, "order idempotency payload mismatch");
    throw new AppError(409, "Idempotency-Key was reused with a different request");
  }

  if (existing.status !== "COMPLETED" || !existing.orderId) {
    logger.warn(logBase, "order idempotency in progress");
    throw new AppError(409, "Order creation is already in progress for this Idempotency-Key");
  }

  const order = await ordersRepository.findById(existing.orderId);
  if (!order || order.customer.id !== customerId) {
    throw new AppError(404, "Order not found");
  }

  logger.info({ ...logBase, orderId: existing.orderId }, "order idempotency replay");
  return order;
}
