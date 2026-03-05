import { prisma } from "../../shared/database/index.js";
import { authRepository } from "./auth.repository.js";
import { hashPassword, comparePassword } from "../../shared/utils/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshExpiresAt,
} from "../../shared/utils/jwt.js";
import { generateVerificationCode, getVerificationExpiresAt } from "../../shared/utils/verificationCode.js";
import { sendVerificationCode } from "../../shared/utils/sendVerificationCode.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RegisterInput, VerifyEmailInput, LoginInput } from "./auth.dto.js";
import type { Role } from "../../shared/types/roles.js";

// Type assertion helper — RevokedToken is added by Sprint 6 migration; the Prisma
// client types will be regenerated on the next `prisma generate` in the dev environment.
const db = prisma as typeof prisma & {
  revokedToken: {
    findUnique: (args: { where: { jti: string } }) => Promise<{ id: string } | null>;
    create: (args: { data: { jti: string; userId: string; expiresAt: Date } }) => Promise<unknown>;
    upsert: (args: {
      where: { jti: string };
      update: Record<string, never>;
      create: { jti: string; userId: string; expiresAt: Date };
    }) => Promise<unknown>;
  };
};

export const authService = {
  /**
   * Step 1: Register with email. Creates a pending registration and sends a 6-digit code.
   * Only CUSTOMER and SELLER can register; ADMIN is only created via seed.
   */
  async register(input: RegisterInput) {
    const existingUser = await authRepository.findByEmail(input.email);
    if (existingUser) throw new AppError(409, "Email already registered");

    const code = generateVerificationCode();
    const expiresAt = getVerificationExpiresAt();
    const passwordHash = await hashPassword(input.password);

    await prisma.pendingRegistration.upsert({
      where: { email: input.email.toLowerCase().trim() },
      update: {
        name: input.name,
        passwordHash,
        role: input.role,
        storeName: input.role === "SELLER" ? input.storeName ?? null : null,
        code,
        expiresAt,
      },
      create: {
        email: input.email.toLowerCase().trim(),
        name: input.name,
        passwordHash,
        role: input.role,
        storeName: input.role === "SELLER" ? input.storeName ?? null : null,
        code,
        expiresAt,
      },
    });

    await sendVerificationCode(input.email, code);

    const isDev = process.env.NODE_ENV !== "production";
    return {
      message: "Verification code sent to your email. Use it to confirm your account.",
      ...(isDev ? { code } : {}),
    };
  },

  /**
   * Step 2: Confirm email with code. Creates User (and Seller if role=SELLER, pending approval).
   */
  async verifyEmail(input: VerifyEmailInput) {
    const pending = await prisma.pendingRegistration.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });
    if (!pending) throw new AppError(400, "No pending registration for this email");
    if (pending.code !== input.code) throw new AppError(400, "Invalid verification code");
    if (new Date() > pending.expiresAt) {
      await prisma.pendingRegistration.delete({ where: { id: pending.id } });
      throw new AppError(400, "Verification code expired. Please request a new one.");
    }

    const user = await prisma.user.create({
      data: {
        name: pending.name,
        email: pending.email,
        password: pending.passwordHash,
        role: pending.role,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    if (pending.role === "SELLER" && pending.storeName) {
      await prisma.seller.create({
        data: {
          userId: user.id,
          storeName: pending.storeName,
          commissionRate: 0.1,
          isApproved: false,
        },
      });
    }

    await prisma.pendingRegistration.delete({ where: { id: pending.id } });

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role as Role });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role as Role });
    return {
      user,
      accessToken,
      refreshToken,
      ...(pending.role === "SELLER"
        ? { message: "Account created. Your seller account is pending administrator approval." }
        : {}),
    };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);
    if (!user) throw new AppError(401, "Invalid email or password");
    const valid = await comparePassword(input.password, user.password);
    if (!valid) throw new AppError(401, "Invalid email or password");
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role as Role });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role as Role });
    const { password: _p, ...safe } = user;
    return { user: safe, accessToken, refreshToken };
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);

    // Check token blacklist — reject if already revoked (e.g. after logout)
    const isRevoked = await db.revokedToken.findUnique({ where: { jti: payload.jti } });
    if (isRevoked) throw new AppError(401, "Token has been revoked. Please log in again.");

    const user = await authRepository.findByEmail(payload.email);
    if (!user) throw new AppError(401, "User no longer exists");

    // Rotate: revoke old refresh token, issue new pair
    await db.revokedToken.create({
      data: {
        jti: payload.jti,
        userId: user.id,
        expiresAt: getRefreshExpiresAt(),
      },
    });

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role as Role });
    const newRefreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role as Role });
    const { password: _p, ...safe } = user;
    return { user: safe, accessToken, refreshToken: newRefreshToken };
  },

  /**
   * Logout: add the refresh token to the blacklist so it can't be reused.
   * The access token expires naturally (15m TTL).
   */
  async logout(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      // Upsert prevents duplicate-key errors if called twice
      await db.revokedToken.upsert({
        where: { jti: payload.jti },
        update: {},
        create: {
          jti: payload.jti,
          userId: payload.sub,
          expiresAt: getRefreshExpiresAt(),
        },
      });
    } catch {
      // Silently ignore invalid/expired tokens on logout
    }
    return { message: "Logged out successfully" };
  },
};
