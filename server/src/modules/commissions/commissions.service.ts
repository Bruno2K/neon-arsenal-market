import { prisma } from "../../shared/database/index.js";
import { commissionsRepository } from "./commissions.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

export const commissionsService = {
  async listTransactions(userId: string, role: string) {
    if (role === "ADMIN") {
      return commissionsRepository.findMany();
    }
    const seller = await prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new AppError(404, "Seller not found");
    return commissionsRepository.findManyBySellerId(seller.id);
  },

  async getBalance(userId: string) {
    const seller = await prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new AppError(404, "Seller not found");
    const balance = await commissionsRepository.getBalance(seller.id);
    return { balance: Number(balance) };
  },
};
