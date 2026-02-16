import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";

export const reviewsRepository = {
  async findManyByProductId(productId: string) {
    return prisma.review.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.review.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });
  },

  async create(data: Prisma.ReviewCreateInput) {
    return prisma.review.create({
      data,
      include: {
        user: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });
  },

  async update(id: string, data: Prisma.ReviewUpdateInput) {
    return prisma.review.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });
  },

  async delete(id: string) {
    return prisma.review.delete({ where: { id } });
  },
};
