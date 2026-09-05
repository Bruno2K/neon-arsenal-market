import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";

export const commissionsRepository = {
  async findManyBySellerId(sellerId: string) {
    return prisma.sellerTransaction.findMany({
      where: { sellerId },
      include: {
        order: { select: { id: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findMany() {
    return prisma.sellerTransaction.findMany({
      include: {
        seller: { select: { id: true, storeName: true } },
        order: { select: { id: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getBalance(sellerId: string) {
    // Projection only. Authoritative history is SellerTransaction (ADR 0011).
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { balance: true },
    });
    return seller?.balance ?? new Prisma.Decimal(0);
  },
};
