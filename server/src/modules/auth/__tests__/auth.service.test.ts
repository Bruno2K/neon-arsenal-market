import { describe, it, expect, vi, beforeEach } from "vitest";
import { authService } from "../auth.service.js";
import { authRepository } from "../auth.repository.js";

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

    it("returns user and tokens when registration succeeds", async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(authRepository.create).mockResolvedValue({
        id: "u1",
        name: "User",
        email: "new@test.com",
        password: "hashed",
        role: "CUSTOMER",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      const result = await authService.register({
        name: "User",
        email: "new@test.com",
        password: "password123",
        role: "CUSTOMER",
      });
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken", "access");
      expect(result).toHaveProperty("refreshToken", "refresh");
      expect(authRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "User", email: "new@test.com", role: "CUSTOMER" })
      );
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
