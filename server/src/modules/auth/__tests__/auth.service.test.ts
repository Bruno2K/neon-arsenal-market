import { describe, it, expect, vi, beforeEach } from "vitest";

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
  },
}));

vi.mock("../auth.repository.js");
vi.mock("../../../shared/utils/hash.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  comparePassword: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../../shared/utils/jwt.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("access"),
  signRefreshToken: vi.fn().mockReturnValue("refresh"),
  verifyRefreshToken: vi.fn().mockReturnValue({ sub: "u1", email: "u@test.com", role: "CUSTOMER" }),
}));
vi.mock("../../../shared/utils/sendVerificationCode.js", () => ({
  assertVerificationEmailDeliveryConfigured: vi.fn(),
  sendVerificationCode: vi.fn().mockResolvedValue(undefined),
}));

import { authService } from "../auth.service.js";
import { authRepository } from "../auth.repository.js";
import { prisma } from "../../../shared/database/index.js";
import {
  assertVerificationEmailDeliveryConfigured,
  sendVerificationCode,
} from "../../../shared/utils/sendVerificationCode.js";

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("throws 409 when email already exists", async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue({
        id: "u1",
        name: "x",
        email: "x@test.com",
        password: "h",
        role: "CUSTOMER",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
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
    it("throws 401 for invalid email", async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue(null);
      await expect(
        authService.login({ email: "nope@test.com", password: "any" })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
