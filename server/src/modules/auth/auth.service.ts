import { authRepository } from "./auth.repository.js";
import { hashPassword, comparePassword } from "../../shared/utils/hash.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RegisterInput, LoginInput } from "./auth.dto.js";

export const authService = {
  async register(input: RegisterInput) {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) throw new AppError(409, "Email already registered");
    const hashed = await hashPassword(input.password);
    const user = await authRepository.create({
      name: input.name,
      email: input.email,
      password: hashed,
      role: input.role,
    });
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role });
    return { user, accessToken, refreshToken };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);
    if (!user) throw new AppError(401, "Invalid email or password");
    const valid = await comparePassword(input.password, user.password);
    if (!valid) throw new AppError(401, "Invalid email or password");
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role });
    const { password: _p, ...safe } = user;
    return { user: safe, accessToken, refreshToken };
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const user = await authRepository.findByEmail(payload.email);
    if (!user) throw new AppError(401, "User no longer exists");
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const newRefreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role });
    const { password: _p, ...safe } = user;
    return { user: safe, accessToken, refreshToken: newRefreshToken };
  },
};
