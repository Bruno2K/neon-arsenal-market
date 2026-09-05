import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";
import {
  createdAtIdDescOrderBy,
  createdAtIdKeysetWhere,
  type CreatedAtIdCursor,
} from "../../shared/pagination/cursor.js";

const productListInclude = {
  listings: {
    where: { status: "ACTIVE" as const },
    take: 1,
    orderBy: { price: "asc" as const },
  },
  _count: {
    select: { listings: { where: { status: "ACTIVE" as const } } },
  },
} as const;

export const productsRepository = {
  async findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.ProductWhereInput;
  }) {
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        include: productListInclude,
        orderBy: createdAtIdDescOrderBy,
      }),
      prisma.product.count({ where: params.where }),
    ]);
    return { items, total };
  },

  async findManyByKeyset(params: {
    take: number;
    where?: Prisma.ProductWhereInput;
    after?: CreatedAtIdCursor;
  }) {
    const keyset = params.after ? createdAtIdKeysetWhere(params.after) : undefined;
    const where: Prisma.ProductWhereInput | undefined = params.where
      ? keyset
        ? { AND: [params.where, keyset] }
        : params.where
      : keyset;

    const rows = await prisma.product.findMany({
      where,
      take: params.take + 1,
      include: productListInclude,
      orderBy: createdAtIdDescOrderBy,
    });
    const hasMore = rows.length > params.take;
    return { items: hasMore ? rows.slice(0, params.take) : rows, hasMore };
  },

  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        listings: {
          where: { status: "ACTIVE" },
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                rating: true,
                user: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { price: "asc" },
        },
        _count: {
          select: { listings: { where: { status: "ACTIVE" } } },
        },
      },
    });
  },

  async create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({
      data,
    });
  },

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },
};
