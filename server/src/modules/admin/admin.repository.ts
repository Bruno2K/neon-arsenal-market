import { prisma } from "../../shared/database/index.js";

export const adminRepository = {
  async findAllUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        seller: { select: { id: true, storeName: true, isApproved: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
