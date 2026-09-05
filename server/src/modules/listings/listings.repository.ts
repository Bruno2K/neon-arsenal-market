import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";
import type { ListingStatus } from "../../shared/types/roles.js";
import {
  createdAtIdDescOrderBy,
  createdAtIdKeysetWhere,
  type CreatedAtIdCursor,
} from "../../shared/pagination/cursor.js";

const listingListInclude = {
  product: true,
  seller: {
    select: {
      id: true,
      storeName: true,
      rating: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

export const listingsRepository = {
  async findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.ListingWhereInput;
    orderBy?: Prisma.ListingOrderByWithRelationInput | Prisma.ListingOrderByWithRelationInput[];
  }) {
    const [items, total] = await prisma.$transaction([
      prisma.listing.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy ?? createdAtIdDescOrderBy,
        include: listingListInclude,
      }),
      prisma.listing.count({ where: params.where }),
    ]);
    return { items, total };
  },

  async findManyByKeyset(params: {
    take: number;
    where?: Prisma.ListingWhereInput;
    after?: CreatedAtIdCursor;
  }) {
    const keyset = params.after ? createdAtIdKeysetWhere(params.after) : undefined;
    const where: Prisma.ListingWhereInput | undefined = params.where
      ? keyset
        ? { AND: [params.where, keyset] }
        : params.where
      : keyset;

    const rows = await prisma.listing.findMany({
      where,
      take: params.take + 1,
      orderBy: createdAtIdDescOrderBy,
      include: listingListInclude,
    });
    const hasMore = rows.length > params.take;
    return { items: hasMore ? rows.slice(0, params.take) : rows, hasMore };
  },

  async findById(id: string) {
    return prisma.listing.findUnique({
      where: { id },
      include: listingListInclude,
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
      orderBy: createdAtIdDescOrderBy,
      ...params,
    });
  },

  async updateStatus(id: string, status: ListingStatus, soldAt?: Date) {
    return prisma.listing.update({
      where: { id },
      data: {
        status,
        ...(soldAt && { soldAt }),
      },
    });
  },
};
