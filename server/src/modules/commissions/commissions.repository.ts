import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/index.js";
import { paidLedgerSumOrZero } from "../../shared/money/sellerLedger.js";

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

  async listProjections() {
    return prisma.seller.findMany({
      select: { id: true, balance: true },
    });
  },

  async sumPaidNetGrouped() {
    return prisma.sellerTransaction.groupBy({
      by: ["sellerId"],
      where: { status: "PAID" },
      _sum: { netAmount: true },
    });
  },

  /**
   * Hold the projection row so confirmPayment's increment cannot land between
   * the PAID SUM read and a corrective SET (issue #45 / ADR 0011).
   */
  async lockSellerForUpdate(tx: Prisma.TransactionClient, sellerId: string) {
    await tx.$queryRaw`SELECT 1 FROM "Seller" WHERE id = ${sellerId} FOR UPDATE`;
  },

  async sumPaidNetForSeller(tx: Prisma.TransactionClient, sellerId: string) {
    const paid = await tx.sellerTransaction.aggregate({
      where: { sellerId, status: "PAID" },
      _sum: { netAmount: true },
    });
    return paidLedgerSumOrZero(paid._sum.netAmount);
  },
};
