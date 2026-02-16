import { prisma } from "../../shared/database/index.js";

export const usersRepository = {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
  },

  async update(id: string, data: { name?: string; email?: string; password?: string }) {
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
  },
};
