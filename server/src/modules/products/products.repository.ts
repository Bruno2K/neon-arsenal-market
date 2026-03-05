import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";

export const productsRepository = {
  async findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.ProductWhereInput;
  }) {
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        ...params,
        include: {
          listings: {
            where: { status: "ACTIVE" },
            take: 1,
            orderBy: { price: "asc" },
          },
          _count: {
            select: { listings: { where: { status: "ACTIVE" } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where: params.where }),
    ]);
    return { items, total };
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
