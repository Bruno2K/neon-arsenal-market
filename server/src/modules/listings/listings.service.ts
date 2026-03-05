import { prisma } from "../../shared/database/index.js";
import { listingsRepository } from "./listings.repository.js";
import { priceHistoryRepository } from "./price-history.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  CreateListingInput,
  UpdateListingInput,
  UpdateListingPriceInput,
  ListListingsQuery,
} from "./listings.dto.js";

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["RESERVED", "CANCELED"],
  RESERVED: ["ACTIVE", "SOLD", "CANCELED"],
  SOLD: [],
  CANCELED: [],
};

export const listingsService = {
  async list(query: ListListingsQuery) {
    const where: any = {};

    if (query.productId) where.productId = query.productId;
    if (query.sellerId) where.sellerId = query.sellerId;
    if (query.status) where.status = query.status;

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    if (query.minFloat !== undefined || query.maxFloat !== undefined) {
      where.floatValue = {};
      if (query.minFloat !== undefined) where.floatValue.gte = query.minFloat;
      if (query.maxFloat !== undefined) where.floatValue.lte = query.maxFloat;
    }

    if (query.exterior || query.isStattrak !== undefined) {
      where.product = {};
      if (query.exterior) where.product.exterior = query.exterior;
      if (query.isStattrak !== undefined) where.product.isStattrak = query.isStattrak;
    }

    const skip = (query.page - 1) * query.limit;
    const { items, total } = await listingsRepository.findMany({
      skip,
      take: query.limit,
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
    });

    return { items, total, page: query.page, limit: query.limit };
  },

  async getById(id: string) {
    const listing = await listingsRepository.findById(id);
    if (!listing) throw new AppError(404, "Listing not found");
    return listing;
  },

  async create(userId: string, input: CreateListingInput) {
    // Verify seller exists
    const seller = await prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new AppError(404, "Seller not found");

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) throw new AppError(404, "Product not found");

    // Validate trade lock
    if (input.tradeLockUntil) {
      const lockDate = typeof input.tradeLockUntil === "string" ? new Date(input.tradeLockUntil) : input.tradeLockUntil;
      if (lockDate <= new Date()) {
        throw new AppError(400, "Trade lock date must be in the future");
      }
    }

    return listingsRepository.create({
      product: { connect: { id: input.productId } },
      seller: { connect: { id: seller.id } },
      floatValue: input.floatValue,
      pattern: input.pattern,
      price: input.price,
      currency: input.currency || "USD",
      tradeLockUntil: input.tradeLockUntil
        ? typeof input.tradeLockUntil === "string"
          ? new Date(input.tradeLockUntil)
          : input.tradeLockUntil
        : undefined,
      steamAssetId: input.steamAssetId,
      status: "ACTIVE",
    });
  },

  async update(listingId: string, userId: string, role: string, input: UpdateListingInput) {
    const listing = await listingsRepository.findById(listingId);
    if (!listing) throw new AppError(404, "Listing not found");

    // Authorization check
    if (role !== "ADMIN") {
      const seller = await prisma.seller.findUnique({ where: { userId } });
      if (!seller || listing.sellerId !== seller.id) {
        throw new AppError(403, "Not your listing");
      }
    }

    // Validate status transition
    if (input.status && listing.status !== input.status) {
      const allowedTransitions = VALID_STATUS_TRANSITIONS[listing.status] || [];
      if (!allowedTransitions.includes(input.status)) {
        throw new AppError(400, `Invalid status transition from ${listing.status} to ${input.status}`);
      }
    }

    const updateData: any = {};
    if (input.price !== undefined) updateData.price = input.price;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tradeLockUntil !== undefined) {
      updateData.tradeLockUntil = input.tradeLockUntil === null ? null : new Date(input.tradeLockUntil as string);
    }

    return listingsRepository.update(listingId, updateData);
  },

  async updatePrice(listingId: string, userId: string, role: string, input: UpdateListingPriceInput) {
    const listing = await listingsRepository.findById(listingId);
    if (!listing) throw new AppError(404, "Listing not found");

    // Authorization check
    if (role !== "ADMIN") {
      const seller = await prisma.seller.findUnique({ where: { userId } });
      if (!seller || listing.sellerId !== seller.id) {
        throw new AppError(403, "Not your listing");
      }
    }

    if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
      throw new AppError(400, "Can only update price for ACTIVE or RESERVED listings");
    }

    const oldPrice = Number(listing.price);
    const newPrice = input.newPrice;

    if (oldPrice === newPrice) {
      throw new AppError(400, "New price must be different from current price");
    }

    // Update listing price
    const updatedListing = await listingsRepository.update(listingId, { price: newPrice });

    // Create price history entry
    await priceHistoryRepository.create({
      listing: { connect: { id: listingId } },
      oldPrice,
      newPrice,
    });

    return updatedListing;
  },

  async reserve(listingId: string) {
    const listing = await listingsRepository.findById(listingId);
    if (!listing) throw new AppError(404, "Listing not found");

    if (listing.status !== "ACTIVE") {
      throw new AppError(400, `Listing is not ACTIVE (current status: ${listing.status})`);
    }

    if (listing.tradeLockUntil && new Date(listing.tradeLockUntil) > new Date()) {
      throw new AppError(400, "Listing is trade locked");
    }

    return listingsRepository.updateStatus(listingId, "RESERVED");
  },

  async markAsSold(listingId: string) {
    const listing = await listingsRepository.findById(listingId);
    if (!listing) throw new AppError(404, "Listing not found");

    if (listing.status !== "RESERVED") {
      throw new AppError(400, `Listing must be RESERVED to mark as SOLD (current status: ${listing.status})`);
    }

    return listingsRepository.updateStatus(listingId, "SOLD", new Date());
  },

  async cancel(listingId: string, userId: string, role: string) {
    const listing = await listingsRepository.findById(listingId);
    if (!listing) throw new AppError(404, "Listing not found");

    // Authorization check
    if (role !== "ADMIN") {
      const seller = await prisma.seller.findUnique({ where: { userId } });
      if (!seller || listing.sellerId !== seller.id) {
        throw new AppError(403, "Not your listing");
      }
    }

    if (listing.status === "SOLD") {
      throw new AppError(400, "Cannot cancel a SOLD listing");
    }

    return listingsRepository.updateStatus(listingId, "CANCELED");
  },

  async getBySellerUserId(userId: string) {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) throw new AppError(404, "Seller not found");

    const items = await listingsRepository.findBySellerId(seller.id);
    return { items, total: items.length };
  },
};
