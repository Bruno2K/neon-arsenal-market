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
          seller: {
            select: { id: true, storeName: true, user: { select: { name: true } } },
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

  async create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({
      data,
      include: {
        seller: { select: { id: true, storeName: true } },
      },
    });
  },

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({
      where: { id },
      data,
      include: {
        seller: { select: { id: true, storeName: true } },
      },
    });
  },

  async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },

  async decrementStock(id: string, quantity: number) {
    return prisma.product.update({
      where: { id },
      data: { stock: { decrement: quantity } },
    });
  },

  async findByIdForOrder(id: string) {
    return prisma.product.findUnique({
      where: { id, isActive: true },
      select: { id: true, sellerId: true, price: true, stock: true, name: true },
    });
  },
};
