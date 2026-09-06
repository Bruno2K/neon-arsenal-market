import { prisma } from "../../shared/database/index.js";
import type { Prisma } from "@prisma/client";
import type { Role } from "../../shared/types/roles.js";
import {
  nextAllowedAtAfterFailure,
  normalizeLoginEmail,
  retryAfterSeconds,
  shouldResetThrottleWindow,
} from "./loginThrottle.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const authRepository = {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: normalizeLoginEmail(email) },
      select: { id: true, name: true, email: true, password: true, role: true },
    });
  },

  async create(data: { name: string; email: string; password: string; role: Role }) {
    return prisma.user.create({
      data: { ...data, email: normalizeLoginEmail(data.email) },
      select: { id: true, name: true, email: true, role: true },
    });
  },

  async createRefreshToken(
    data: { jti: string; familyId: string; userId: string; expiresAt: Date },
    db: DbClient = prisma
  ) {
    return db.refreshToken.create({ data });
  },

  async findRefreshTokenByJti(jti: string, db: DbClient = prisma) {
    return db.refreshToken.findUnique({ where: { jti } });
  },

  /**
   * Atomic rotation claim. Returns 1 only for the unused, unrevoked, unexpired row.
   */
  async claimRefreshToken(jti: string, usedAt: Date, db: DbClient = prisma) {
    return db.refreshToken.updateMany({
      where: {
        jti,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: usedAt },
      },
      data: { usedAt },
    });
  },

  async revokeFamily(familyId: string, revokedAt: Date, db: DbClient = prisma) {
    return db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
  },

  async getLoginThrottle(emailNormalized: string) {
    return prisma.loginThrottle.findUnique({ where: { emailNormalized } });
  },

  async clearLoginThrottle(emailNormalized: string) {
    await prisma.loginThrottle.deleteMany({ where: { emailNormalized } });
  },

  /**
   * Record a failed password check. Resets the window after 15 quiet minutes.
   * Returns Retry-After seconds if the next attempt must wait.
   */
  async recordFailedLogin(emailNormalized: string, now = new Date()): Promise<number | null> {
    const existing = await prisma.loginThrottle.findUnique({ where: { emailNormalized } });
    const failedCount =
      !existing || shouldResetThrottleWindow(existing.lastFailedAt, now) ? 1 : existing.failedCount + 1;
    const nextAllowedAt = nextAllowedAtAfterFailure(failedCount, now);

    await prisma.loginThrottle.upsert({
      where: { emailNormalized },
      create: {
        emailNormalized,
        failedCount,
        lastFailedAt: now,
        nextAllowedAt,
      },
      update: {
        failedCount,
        lastFailedAt: now,
        nextAllowedAt,
      },
    });

    if (!nextAllowedAt) return null;
    return retryAfterSeconds(nextAllowedAt, now);
  },

  secondsUntilLoginAllowed(
    throttle: { nextAllowedAt: Date | null } | null,
    now = new Date()
  ): number | null {
    if (!throttle?.nextAllowedAt || throttle.nextAllowedAt.getTime() <= now.getTime()) {
      return null;
    }
    return retryAfterSeconds(throttle.nextAllowedAt, now);
  },
};
