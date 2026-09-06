import { beforeEach, describe, expect, it, vi } from "vitest";
import { logout } from "../auth";

const post = vi.fn();
const getRefreshToken = vi.fn();
const clear = vi.fn();

vi.mock("../client", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
  },
  tokenStorage: {
    getRefreshToken: () => getRefreshToken() as string | null,
    clear: () => clear(),
    getAccessToken: () => null,
    setTokens: () => undefined,
  },
}));

describe("auth.logout", () => {
  beforeEach(() => {
    post.mockReset();
    getRefreshToken.mockReset();
    clear.mockReset();
    post.mockResolvedValue({ message: "Logged out successfully" });
  });

  it("posts the refresh token to POST /auth/logout then clears storage", async () => {
    getRefreshToken.mockReturnValue("refresh-token-1");

    await logout();

    expect(post).toHaveBeenCalledWith(
      "/auth/logout",
      { refreshToken: "refresh-token-1" },
      { skipAuth: true },
    );
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("does not call the revoke endpoint when there is no refresh token", async () => {
    getRefreshToken.mockReturnValue(null);

    await logout();

    expect(post).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("clears local tokens even when revoke fails", async () => {
    getRefreshToken.mockReturnValue("refresh-token-1");
    post.mockRejectedValue(new Error("network"));

    await logout();

    expect(post).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
