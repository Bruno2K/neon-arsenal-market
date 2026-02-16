import { prisma } from "../../shared/database/index.js";
import type { Role } from "../../shared/types/roles.js";

export const authRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true, role: true },
    });
  },

  async create(data: { name: string; email: string; password: string; role: Role }) {
    return prisma.user.create({
      data,
      select: { id: true, name: true, email: true, role: true },
    });
  },
};
