import { priceHistoryRepository } from "./price-history.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { prisma } from "../../shared/database/index.js";

export const priceHistoryService = {
  async getHistory(listingId: string) {
    // Verify listing exists
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!listing) throw new AppError(404, "Listing not found");

    return priceHistoryRepository.findByListingId(listingId);
  },

  async create(listingId: string, oldPrice: number, newPrice: number) {
    return priceHistoryRepository.create({
      listing: { connect: { id: listingId } },
      oldPrice,
      newPrice,
    });
  },
};
