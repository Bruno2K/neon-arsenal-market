import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";

export const listingsRepository = {
  async findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.ListingWhereInput;
    orderBy?: Prisma.ListingOrderByWithRelationInput;
  }) {
    const [items, total] = await prisma.$transaction([
      prisma.listing.findMany({
        ...params,
        include: {
          product: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              rating: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.listing.count({ where: params.where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.listing.findUnique({
      where: { id },
      include: {
        product: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            rating: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async create(data: Prisma.ListingCreateInput) {
    return prisma.listing.create({
      data,
      include: {
        product: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async update(id: string, data: Prisma.ListingUpdateInput) {
    return prisma.listing.update({
      where: { id },
      data,
      include: {
        product: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async delete(id: string) {
    return prisma.listing.delete({ where: { id } });
  },

  async findByIdForOrder(id: string) {
    return prisma.listing.findUnique({
      where: { id, status: "ACTIVE" },
      select: {
        id: true,
        productId: true,
        sellerId: true,
        price: true,
        status: true,
        tradeLockUntil: true,
      },
    });
  },

  async findBySellerId(sellerId: string, params?: { skip?: number; take?: number }) {
    return prisma.listing.findMany({
      where: { sellerId },
      include: {
        product: true,
      },
      orderBy: { createdAt: "desc" },
      ...params,
    });
  },

  async updateStatus(id: string, status: string, soldAt?: Date) {
    return prisma.listing.update({
      where: { id },
      data: {
        status,
        ...(soldAt && { soldAt }),
      },
    });
  },
};
