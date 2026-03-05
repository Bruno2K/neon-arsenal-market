// ─── Infrastructure: HttpClient ─────────────────────────────────────────────
// Lightweight fetch wrapper with:
//   - Automatic Authorization header injection
//   - Silent access-token refresh on 401 (with queue to avoid parallel refresh)
//   - Session-expired event dispatched when refresh fails
//   - No external dependencies (native fetch)

import { HttpError } from './HttpError';

// ── Token Storage ──────────────────────────────────────────────────────────
const ACCESS_TOKEN_KEY  = 'neon_access_token';
const REFRESH_TOKEN_KEY = 'neon_refresh_token';

export const tokenStorage = {
  getAccessToken:  () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY,  accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ── Config ─────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ── Types ──────────────────────────────────────────────────────────────────
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

// ── Response Parser ────────────────────────────────────────────────────────
async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      isJson && data !== null && typeof data === 'object' && 'error' in data
        ? String((data as Record<string, unknown>).error)
        : `HTTP ${res.status}`;
    throw new HttpError(res.status, message, data);
  }

  return data as T;
}

// ── Token Refresh (with queue to prevent parallel refresh calls) ───────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise<string>((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;

  try {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) throw new HttpError(401, 'No refresh token available');

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await parseResponse<{ accessToken: string; refreshToken: string }>(res);
    tokenStorage.setTokens(data.accessToken, data.refreshToken);

    refreshQueue.forEach((resolve) => resolve(data.accessToken));
    refreshQueue = [];

    return data.accessToken;
  } catch {
    tokenStorage.clearTokens();
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    throw new HttpError(401, 'Session expired. Please log in again.');
  } finally {
    isRefreshing = false;
  }
}

// ── Main Request Function ──────────────────────────────────────────────────
export async function httpRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
  _retry = true,
): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {} } = options;

  const accessToken = tokenStorage.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh once on 401
  if (res.status === 401 && _retry) {
    const newToken = await refreshAccessToken();
    return httpRequest<T>(
      endpoint,
      { ...options, headers: { ...extraHeaders, Authorization: `Bearer ${newToken}` } },
      false, // do not retry again
    );
  }

  return parseResponse<T>(res);
}
