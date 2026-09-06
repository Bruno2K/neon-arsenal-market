import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";

const favoriteListingInclude = {
  listing: {
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
  },
} as const;

export const favoritesRepository = {
  async findManyByUserId(userId: string) {
    return prisma.favorite.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: favoriteListingInclude,
    });
  },

  async create(data: Prisma.FavoriteCreateInput) {
    return prisma.favorite.create({ data });
  },

  async deleteByUserAndListing(userId: string, listingId: string) {
    return prisma.favorite.deleteMany({
      where: { userId, listingId },
    });
  },
};
