import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";

export const priceHistoryRepository = {
  async create(data: Prisma.PriceHistoryCreateInput) {
    return prisma.priceHistory.create({
      data,
    });
  },

  async findByListingId(listingId: string) {
    return prisma.priceHistory.findMany({
      where: { listingId },
      orderBy: { changedAt: "desc" },
    });
  },

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PriceHistoryWhereInput;
  }) {
    return prisma.priceHistory.findMany({
      ...params,
      include: {
        listing: {
          select: {
            id: true,
            product: { select: { weapon: true, skinName: true } },
          },
        },
      },
      orderBy: { changedAt: "desc" },
    });
  },
};
