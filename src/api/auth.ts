import { api, tokenStorage } from "./client";
import type { AuthResponse, User } from "@/types/api";

export interface RegisterResponse {
  message: string;
  code?: string;
}

export async function register(body: {
  name: string;
  email: string;
  password: string;
  role?: "CUSTOMER" | "SELLER";
  storeName?: string;
}): Promise<RegisterResponse> {
  return api.post<RegisterResponse>("/auth/register", body, { skipAuth: true });
}

export async function verifyEmail(body: {
  email: string;
  code: string;
}): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/verify-email", body, {
    skipAuth: true,
  });
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function login(body: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>("/auth/login", body, {
    skipAuth: true,
  });
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

/**
 * Revoke the refresh token on the server when one is stored, then clear local
 * tokens. Always clears local state — a failed revoke must not leave the
 * client signed in. Uses skipAuth so logout does not trigger /auth/refresh.
 */
export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();
  try {
    if (refreshToken) {
      await api.post("/auth/logout", { refreshToken }, { skipAuth: true });
    }
  } catch {
    // Local session still ends; revoke is best-effort.
  } finally {
    tokenStorage.clear();
  }
}

export async function me(): Promise<User> {
  return api.get<User>("/auth/me");
}

export function getStoredAccessToken(): string | null {
  return tokenStorage.getAccessToken();
}
