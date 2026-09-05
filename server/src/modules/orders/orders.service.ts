import { createHash } from "node:crypto";
import { prisma } from "../../shared/database/index.js";
import { ordersRepository } from "./orders.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { buildReservationWindow } from "../../shared/config/reservation.js";
import type { CreateOrderInput, UpdateOrderTrackingInput } from "./orders.dto.js";
import { Prisma } from "@prisma/client";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export const ordersService = {
  async create(customerId: string, input: CreateOrderInput, idempotencyKey: string) {
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
    const listingIds = input.items.map((i) => i.listingId);
    if (new Set(listingIds).size !== listingIds.length) {
      throw new AppError(400, "A listing can only appear once in an order");
    }
    const requestHash = createOrderRequestHash(input);

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.orderIdempotencyKey.create({
          data: {
            customerId,
            key: normalizedIdempotencyKey,
            requestHash,
            status: "IN_PROGRESS",
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

        await tx.orderIdempotencyKey.update({
          where: {
            customerId_key: {
              customerId,
              key: normalizedIdempotencyKey,
            },
          },
          data: {
            status: "COMPLETED",
            orderId: order.id,
          },
        });

        return { ...order, totalAmount };
      });

      const order = await ordersRepository.findById(result.id);
      return { ...order!, totalAmount: result.totalAmount };
    } catch (err) {
      if (!isIdempotencyKeyUniqueConstraintError(err)) throw err;

      const existing = await prisma.orderIdempotencyKey.findUnique({
        where: {
          customerId_key: {
            customerId,
            key: normalizedIdempotencyKey,
          },
        },
      });

      if (!existing) throw err;
      if (existing.requestHash !== requestHash) {
        throw new AppError(409, "Idempotency key was already used with a different order request");
      }
      if (existing.status !== "COMPLETED" || !existing.orderId) {
        throw new AppError(409, "Order creation is still in progress for this idempotency key");
      }

      const order = await ordersRepository.findById(existing.orderId);
      if (!order) {
        throw new AppError(409, "Idempotency key references an order that no longer exists");
      }
      return order;
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

function normalizeIdempotencyKey(idempotencyKey: string) {
  const trimmed = idempotencyKey.trim();
  if (!trimmed) {
    throw new AppError(400, "Idempotency-Key header is required");
  }
  if (trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new AppError(400, `Idempotency-Key must be ${IDEMPOTENCY_KEY_MAX_LENGTH} characters or fewer`);
  }
  return trimmed;
}

function createOrderRequestHash(input: CreateOrderInput) {
  const listingIds = input.items.map((item) => item.listingId).sort();
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, listingIds }))
    .digest("hex");
}

function isIdempotencyKeyUniqueConstraintError(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }

  const target = err.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("customerId") && target.includes("key");
  }
  if (typeof target === "string") {
    return target.includes("OrderIdempotencyKey_customerId_key_key") || target.includes("customerId_key");
  }
  return false;
}
