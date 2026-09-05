import { prisma } from "../../shared/database/index.js";
import { listingsRepository } from "./listings.repository.js";
import { priceHistoryRepository } from "./price-history.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { buildReservationWindow } from "../../shared/config/reservation.js";
import type { Prisma } from "@prisma/client";
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
    const where: Prisma.ListingWhereInput = {};

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

    const updateData: Prisma.ListingUpdateInput = {};
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
    const now = new Date();
    const reservation = buildReservationWindow(now);
    const reserved = await prisma.listing.updateMany({
      where: {
        id: listingId,
        status: "ACTIVE",
        OR: [{ tradeLockUntil: null }, { tradeLockUntil: { lte: now } }],
      },
      data: {
        status: "RESERVED",
        reservedAt: reservation.reservedAt,
        reservationExpiresAt: reservation.reservationExpiresAt,
      },
    });

    if (reserved.count !== 1) {
      const listing = await listingsRepository.findById(listingId);
      if (!listing) throw new AppError(404, "Listing not found");
      if (listing.tradeLockUntil && new Date(listing.tradeLockUntil) > now) {
        throw new AppError(400, "Listing is trade locked");
      }
      throw new AppError(400, `Listing is not ACTIVE (current status: ${listing.status})`);
    }

    const listing = await listingsRepository.findById(listingId);
    if (!listing) throw new AppError(404, "Listing not found");
    return listing;
  },

  async markAsSold(listingId: string) {
    const now = new Date();
    const sold = await prisma.listing.updateMany({
      where: {
        id: listingId,
        status: "RESERVED",
        reservationExpiresAt: { gt: now },
      },
      data: { status: "SOLD", soldAt: now },
    });

    if (sold.count !== 1) {
      const listing = await listingsRepository.findById(listingId);
      if (!listing) throw new AppError(404, "Listing not found");
      if (listing.status !== "RESERVED") {
        throw new AppError(400, `Listing must be RESERVED to mark as SOLD (current status: ${listing.status})`);
      }
      throw new AppError(409, "Reservation expired or listing is no longer reserved");
    }

    const listing = await listingsRepository.findById(listingId);
    if (!listing) throw new AppError(404, "Listing not found");
    return listing;
  },

  /**
   * Release expired reservations back to ACTIVE and cancel unpaid orders
   * that no longer hold a RESERVED listing.
   *
   * The listing UPDATE is conditional on `status = RESERVED`, so a concurrent
   * payment that already moved the row to SOLD cannot be overwritten.
   * Order cancellation is a separate statement so lock order (listings vs
   * orders) cannot deadlock against payment confirmation.
   */
  async expireReservations(now = new Date()) {
    const expiredListings = await prisma.listing.updateMany({
      where: {
        status: "RESERVED",
        OR: [{ reservationExpiresAt: { lte: now } }, { reservationExpiresAt: null }],
      },
      data: {
        status: "ACTIVE",
        reservedAt: null,
        reservationExpiresAt: null,
        reservedByOrderId: null,
      },
    });

    // Cancel unpaid orders that no longer hold their listings, including the
    // crash window where a listing was released and reserved by a later order.
    const cancelledOrders = await prisma.$executeRaw`
      UPDATE "Order" AS o
      SET status = 'CANCELLED'
      WHERE o."paymentStatus" = 'PENDING'
        AND o.status = 'PENDING'
        AND EXISTS (
          SELECT 1
          FROM "OrderItem" i
          INNER JOIN "Listing" l ON l.id = i."listingId"
          WHERE i."orderId" = o.id
            AND (l.status <> 'RESERVED' OR l."reservedByOrderId" IS DISTINCT FROM o.id)
        )
    `;

    return {
      expiredListingCount: expiredListings.count,
      cancelledOrderCount: Number(cancelledOrders),
    };
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
