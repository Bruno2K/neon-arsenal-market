import { prisma } from "../../shared/database/index.js";
import { sellersRepository } from "./sellers.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ApplySellerInput, UpdateSellerInput } from "./sellers.dto.js";

export const sellersService = {
  async list(filters?: { isApproved?: boolean }) {
    return sellersRepository.findMany(filters);
  },

  async getById(id: string) {
    const seller = await sellersRepository.findById(id);
    if (!seller) throw new AppError(404, "Seller not found");
    return seller;
  },

  async getByUserId(userId: string) {
    const seller = await sellersRepository.findByUserId(userId);
    if (!seller) throw new AppError(404, "Seller not found");
    return seller;
  },

  async apply(userId: string, input: ApplySellerInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, "User not found");
    if (user.role !== "CUSTOMER" && user.role !== "SELLER")
      throw new AppError(403, "Only customers can apply to become sellers");
    const existing = await sellersRepository.findByUserId(userId);
    if (existing) throw new AppError(409, "Already a seller");
    const seller = await prisma.seller.create({
      data: {
        userId,
        storeName: input.storeName,
        commissionRate: input.commissionRate,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { role: "SELLER" },
    });
    return seller;
  },

  async update(sellerId: string, userId: string, role: string, input: UpdateSellerInput) {
    const seller = await sellersRepository.findById(sellerId);
    if (!seller) throw new AppError(404, "Seller not found");
    if (seller.userId !== userId && role !== "ADMIN")
      throw new AppError(403, "Cannot update another seller");
    return sellersRepository.update(sellerId, input);
  },

  async approve(sellerId: string, isApproved: boolean) {
    const seller = await sellersRepository.findById(sellerId);
    if (!seller) throw new AppError(404, "Seller not found");
    return sellersRepository.update(sellerId, { isApproved });
  },
};
