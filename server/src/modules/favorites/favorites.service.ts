import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import { favoritesRepository } from "./favorites.repository.js";
import type { CreateFavoriteInput } from "./favorites.dto.js";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const favoritesService = {
  async list(userId: string) {
    const rows = await favoritesRepository.findManyByUserId(userId);
    return {
      items: rows.map((row) => ({
        listingId: row.listingId,
        listing: row.listing,
      })),
    };
  },

  async add(userId: string, input: CreateFavoriteInput) {
    const listing = await prisma.listing.findUnique({
      where: { id: input.listingId },
      select: { id: true },
    });
    if (!listing) throw new AppError(404, "Listing not found");

    try {
      await favoritesRepository.create({
        user: { connect: { id: userId } },
        listing: { connect: { id: listing.id } },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    return { listingId: listing.id };
  },

  async remove(userId: string, listingId: string) {
    await favoritesRepository.deleteByUserAndListing(userId, listingId);
  },
};
