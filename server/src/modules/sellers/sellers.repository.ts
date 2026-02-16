import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";

export const sellersRepository = {
  async findMany(filters?: { isApproved?: boolean }) {
    return prisma.seller.findMany({
      where: filters,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.seller.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async findByUserId(userId: string) {
    return prisma.seller.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async create(data: Prisma.SellerCreateInput) {
    return prisma.seller.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async update(id: string, data: Prisma.SellerUpdateInput) {
    return prisma.seller.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async incrementBalance(sellerId: string, amount: number) {
    return prisma.seller.update({
      where: { id: sellerId },
      data: { balance: { increment: amount } },
    });
  },
};
