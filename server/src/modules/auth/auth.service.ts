import { randomUUID } from "crypto";
import { prisma } from "../../shared/database/index.js";
import { authRepository } from "./auth.repository.js";
import {
  hashPassword,
  comparePassword,
  UNKNOWN_USER_PASSWORD_HASH,
} from "../../shared/utils/hash.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshExpiresAt,
  type RefreshJwtPayload,
} from "../../shared/utils/jwt.js";
import { generateVerificationCode, getVerificationExpiresAt } from "../../shared/utils/verificationCode.js";
import {
  assertVerificationEmailDeliveryConfigured,
  sendVerificationCode,
} from "../../shared/utils/sendVerificationCode.js";
import { AppError } from "../../shared/errors/AppError.js";
import { logger } from "../../shared/logger.js";
import { normalizeLoginEmail } from "./loginThrottle.js";
import type { RegisterInput, VerifyEmailInput, LoginInput } from "./auth.dto.js";
import type { Role } from "../../shared/types/roles.js";

const REUSE_MESSAGE = "Refresh token reuse detected. Please log in again.";
const INVALID_REFRESH_MESSAGE = "Invalid or expired refresh token";
const LOGIN_THROTTLE_MESSAGE = "Too many login attempts. Try again later.";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

type SessionUser = { id: string; name: string; email: string; role: Role };

function wrapRefreshVerify(refreshToken: string): RefreshJwtPayload {
  try {
    return verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, INVALID_REFRESH_MESSAGE);
  }
}

async function issueSession(user: SessionUser, familyId = randomUUID()) {
  const jti = randomUUID();
  const expiresAt = getRefreshExpiresAt();
  await authRepository.createRefreshToken({
    jti,
    familyId,
    userId: user.id,
    expiresAt,
  });
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    jti,
    familyId,
  });
  return { user, accessToken, refreshToken };
}

export const authService = {
  /**
   * Step 1: Register with email. Creates a pending registration and sends a 6-digit code.
   * Only CUSTOMER and SELLER can register; ADMIN is only created via seed.
   */
  async register(input: RegisterInput) {
    const existingUser = await authRepository.findByEmail(input.email);
    if (existingUser) throw new AppError(409, "Email already registered");
    assertVerificationEmailDeliveryConfigured();

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

    const session = await issueSession(user);
    return {
      ...session,
      ...(pending.role === "SELLER"
        ? { message: "Account created. Your seller account is pending administrator approval." }
        : {}),
    };
  },

  async login(input: LoginInput) {
    const emailNormalized = normalizeLoginEmail(input.email);
    const throttle = await authRepository.getLoginThrottle(emailNormalized);
    const retryAfter = authRepository.secondsUntilLoginAllowed(throttle);
    if (retryAfter != null) {
      throw new AppError(429, LOGIN_THROTTLE_MESSAGE, true, retryAfter);
    }

    const user = await authRepository.findByEmail(emailNormalized);
    const passwordHash = user?.password ?? UNKNOWN_USER_PASSWORD_HASH;
    const valid = await comparePassword(input.password, passwordHash);

    if (!user || !valid) {
      await authRepository.recordFailedLogin(emailNormalized);
      throw new AppError(401, INVALID_CREDENTIALS_MESSAGE);
    }

    await authRepository.clearLoginThrottle(emailNormalized);
    const { password: _p, ...safe } = user;
    return issueSession(safe);
  },

  async refresh(refreshToken: string) {
    const payload = wrapRefreshVerify(refreshToken);
    const now = new Date();

    const rotated = await prisma.$transaction(async (tx) => {
      const claimed = await authRepository.claimRefreshToken(payload.jti, now, tx);
      if (claimed.count === 1) {
        const existing = await authRepository.findRefreshTokenByJti(payload.jti, tx);
        if (!existing) throw new AppError(401, INVALID_REFRESH_MESSAGE);
        if (existing.familyId !== payload.familyId) {
          await authRepository.revokeFamily(existing.familyId, now, tx);
          return { kind: "reuse" as const, familyId: existing.familyId, userId: existing.userId };
        }
        const user = await tx.user.findUnique({
          where: { id: existing.userId },
          select: { id: true, name: true, email: true, role: true },
        });
        if (!user) throw new AppError(401, "User no longer exists");
        const nextJti = randomUUID();
        const expiresAt = getRefreshExpiresAt();
        await authRepository.createRefreshToken(
          {
            jti: nextJti,
            familyId: existing.familyId,
            userId: user.id,
            expiresAt,
          },
          tx
        );
        return { kind: "ok" as const, user, nextJti, familyId: existing.familyId };
      }

      const existing = await authRepository.findRefreshTokenByJti(payload.jti, tx);
      if (existing && (existing.usedAt || existing.revokedAt)) {
        await authRepository.revokeFamily(existing.familyId, now, tx);
        return { kind: "reuse" as const, familyId: existing.familyId, userId: existing.userId };
      }
      return { kind: "invalid" as const };
    });

    if (rotated.kind === "reuse") {
      logger.warn(
        { event: "refresh_token_reuse", userId: rotated.userId, familyId: rotated.familyId },
        "Refresh token family revoked"
      );
      throw new AppError(401, REUSE_MESSAGE);
    }
    if (rotated.kind === "invalid") {
      throw new AppError(401, INVALID_REFRESH_MESSAGE);
    }

    const accessToken = signAccessToken({
      sub: rotated.user.id,
      email: rotated.user.email,
      role: rotated.user.role,
    });
    const newRefreshToken = signRefreshToken({
      sub: rotated.user.id,
      email: rotated.user.email,
      role: rotated.user.role,
      jti: rotated.nextJti,
      familyId: rotated.familyId,
    });
    return { user: rotated.user, accessToken, refreshToken: newRefreshToken };
  },

  /**
   * Logout: revoke the refresh token family. Access tokens expire on TTL.
   */
  async logout(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await authRepository.revokeFamily(payload.familyId, new Date());
    } catch {
      // Silently ignore invalid/expired tokens on logout
    }
    return { message: "Logged out successfully" };
  },
};
