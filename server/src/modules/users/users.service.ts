import { prisma } from "../../shared/database/index.js";
import { usersRepository } from "./users.repository.js";
import { hashPassword } from "../../shared/utils/hash.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { UpdateMeInput } from "./users.dto.js";

export const usersService = {
  async getMe(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new AppError(404, "User not found");
    return user;
  },

  async updateMe(userId: string, input: UpdateMeInput) {
    if (input.email) {
      const existing = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id: userId } },
      });
      if (existing) throw new AppError(409, "Email already in use");
    }
    const data: { name?: string; email?: string; password?: string } = { ...input };
    if (input.password) data.password = await hashPassword(input.password);
    return usersRepository.update(userId, data);
  },
};
