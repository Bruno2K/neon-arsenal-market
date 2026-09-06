import { describe, it, expect, vi, beforeEach } from "vitest";
import { DomainInvariant } from "../../../shared/domain/invariants.js";

vi.mock("../../../shared/database/index.js", () => ({
  prisma: {
    pendingRegistration: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    seller: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../auth.repository.js");
vi.mock("../../../shared/utils/hash.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  comparePassword: vi.fn(),
  UNKNOWN_USER_PASSWORD_HASH: "$2b$dummy",
}));
vi.mock("../../../shared/utils/jwt.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("access"),
  signRefreshToken: vi.fn().mockReturnValue("refresh"),
  verifyRefreshToken: vi.fn(),
  getRefreshExpiresAt: vi.fn().mockReturnValue(new Date("2026-09-13T00:00:00.000Z")),
}));
vi.mock("../../../shared/utils/sendVerificationCode.js", () => ({
  assertVerificationEmailDeliveryConfigured: vi.fn(),
  sendVerificationCode: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../shared/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { authService } from "../auth.service.js";
import { authRepository } from "../auth.repository.js";
import { prisma } from "../../../shared/database/index.js";
import { comparePassword } from "../../../shared/utils/hash.js";
import { verifyRefreshToken, signRefreshToken } from "../../../shared/utils/jwt.js";
import { logger } from "../../../shared/logger.js";
import {
  assertVerificationEmailDeliveryConfigured,
  sendVerificationCode,
} from "../../../shared/utils/sendVerificationCode.js";

const userRow = {
  id: "u1",
  name: "User",
  email: "u@test.com",
  password: "hashed",
  role: "CUSTOMER" as const,
};

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("throws 409 when email already exists", async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue({
        ...userRow,
      });
      await expect(
        authService.register({
          name: "User",
          email: "x@test.com",
          password: "password123",
          role: "CUSTOMER",
        })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("stores a pending registration and sends a verification code", async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(prisma.pendingRegistration.upsert).mockResolvedValue({} as never);

      const result = await authService.register({
        name: "User",
        email: "new@test.com",
        password: "password123",
        role: "CUSTOMER",
      });

      expect(prisma.pendingRegistration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "new@test.com" },
        })
      );
      expect(assertVerificationEmailDeliveryConfigured).toHaveBeenCalled();
      expect(sendVerificationCode).toHaveBeenCalledWith("new@test.com", expect.any(String));
      expect(result).toHaveProperty("message");
      expect(result).not.toHaveProperty("accessToken");
    });
  });

  describe("login", () => {
    it("throws 401 for invalid email after a dummy password compare", async () => {
      vi.mocked(authRepository.getLoginThrottle).mockResolvedValue(null);
      vi.mocked(authRepository.secondsUntilLoginAllowed).mockReturnValue(null);
      vi.mocked(authRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(comparePassword).mockResolvedValue(false);
      vi.mocked(authRepository.recordFailedLogin).mockResolvedValue(null);

      await expect(
        authService.login({ email: "nope@test.com", password: "any" })
      ).rejects.toMatchObject({ statusCode: 401, message: "Invalid email or password" });
      expect(comparePassword).toHaveBeenCalled();
      expect(authRepository.recordFailedLogin).toHaveBeenCalledWith("nope@test.com");
    });

    it("throws 429 with Retry-After when the email is throttled", async () => {
      vi.mocked(authRepository.getLoginThrottle).mockResolvedValue({
        emailNormalized: "u@test.com",
        failedCount: 5,
        lastFailedAt: new Date(),
        nextAllowedAt: new Date(Date.now() + 4000),
        updatedAt: new Date(),
      });
      vi.mocked(authRepository.secondsUntilLoginAllowed).mockReturnValue(4);

      await expect(
        authService.login({ email: "u@test.com", password: "password123" })
      ).rejects.toMatchObject({ statusCode: 429, retryAfterSeconds: 4 });
      expect(authRepository.findByEmail).not.toHaveBeenCalled();
    });

    it("issues a new refresh family on success and clears the throttle", async () => {
      vi.mocked(authRepository.getLoginThrottle).mockResolvedValue(null);
      vi.mocked(authRepository.secondsUntilLoginAllowed).mockReturnValue(null);
      vi.mocked(authRepository.findByEmail).mockResolvedValue(userRow);
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(authRepository.clearLoginThrottle).mockResolvedValue(undefined);
      vi.mocked(authRepository.createRefreshToken).mockResolvedValue({} as never);

      const result = await authService.login({ email: "u@test.com", password: "password123" });

      expect(authRepository.clearLoginThrottle).toHaveBeenCalledWith("u@test.com");
      expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", familyId: expect.any(String), jti: expect.any(String) })
      );
      expect(signRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ sub: "u1", familyId: expect.any(String), jti: expect.any(String) })
      );
      expect(result).toMatchObject({ accessToken: "access", refreshToken: "refresh" });
      expect(result.user).not.toHaveProperty("password");
    });
  });

  describe("refresh", () => {
    const payload = {
      sub: "u1",
      email: "u@test.com",
      role: "CUSTOMER" as const,
      type: "refresh" as const,
      jti: "old-jti",
      familyId: "fam-1",
    };

    it(`rotates an unused token in the same family (${DomainInvariant.AUTH_REFRESH_FAMILY})`, async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(payload);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => unknown) => {
        const tx = { user: { findUnique: vi.fn().mockResolvedValue({ id: "u1", name: "User", email: "u@test.com", role: "CUSTOMER" }) } } as unknown as typeof prisma;
        vi.mocked(authRepository.claimRefreshToken).mockResolvedValue({ count: 1 });
        vi.mocked(authRepository.findRefreshTokenByJti).mockResolvedValue({
          jti: "old-jti",
          familyId: "fam-1",
          userId: "u1",
          usedAt: null,
          revokedAt: null,
          expiresAt: new Date("2099-01-01"),
          id: "row1",
          createdAt: new Date(),
        });
        vi.mocked(authRepository.createRefreshToken).mockResolvedValue({} as never);
        return fn(tx);
      });

      const result = await authService.refresh("old-refresh");
      expect(result.refreshToken).toBe("refresh");
      expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: "fam-1", userId: "u1" }),
        expect.anything()
      );
    });

    it("revokes the family when a used token is presented again", async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(payload);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => unknown) => {
        vi.mocked(authRepository.claimRefreshToken).mockResolvedValue({ count: 0 });
        vi.mocked(authRepository.findRefreshTokenByJti).mockResolvedValue({
          jti: "old-jti",
          familyId: "fam-1",
          userId: "u1",
          usedAt: new Date(),
          revokedAt: null,
          expiresAt: new Date("2099-01-01"),
          id: "row1",
          createdAt: new Date(),
        });
        vi.mocked(authRepository.revokeFamily).mockResolvedValue({ count: 2 });
        return fn({} as typeof prisma);
      });

      await expect(authService.refresh("stolen-old")).rejects.toMatchObject({
        statusCode: 401,
        message: "Refresh token reuse detected. Please log in again.",
      });
      expect(authRepository.revokeFamily).toHaveBeenCalledWith("fam-1", expect.any(Date), expect.anything());
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "refresh_token_reuse", familyId: "fam-1", userId: "u1" }),
        expect.any(String)
      );
      const logged = vi.mocked(logger.warn).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(JSON.stringify(logged)).not.toMatch(/stolen-old|refreshToken/);
    });

    it("maps invalid JWT verification to 401 without leaking internals", async () => {
      vi.mocked(verifyRefreshToken).mockImplementation(() => {
        throw new Error("jwt malformed");
      });
      await expect(authService.refresh("not-a-jwt")).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid or expired refresh token",
      });
    });
  });

  describe("logout", () => {
    it("revokes the family and ignores invalid tokens", async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue({
        sub: "u1",
        email: "u@test.com",
        role: "CUSTOMER",
        type: "refresh",
        jti: "jti-1",
        familyId: "fam-1",
      });
      vi.mocked(authRepository.revokeFamily).mockResolvedValue({ count: 1 });
      await expect(authService.logout("tok")).resolves.toEqual({ message: "Logged out successfully" });
      expect(authRepository.revokeFamily).toHaveBeenCalledWith("fam-1", expect.any(Date));

      vi.mocked(verifyRefreshToken).mockImplementation(() => {
        throw new Error("expired");
      });
      await expect(authService.logout("bad")).resolves.toEqual({ message: "Logged out successfully" });
    });
  });
});
