const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type TokenStorage = {
  getAccessToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  clear: () => void;
  getRefreshToken: () => string | null;
};

const tokenStorage: TokenStorage = {
  getAccessToken: () => localStorage.getItem("accessToken"),
  getRefreshToken: () => localStorage.getItem("refreshToken"),
  setTokens: (access, refresh) => {
    localStorage.setItem("accessToken", access);
    localStorage.setItem("refreshToken", refresh);
  },
  clear: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },
};

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefreshToken();
  if (!refresh) throw new Error("No refresh token");
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    tokenStorage.clear();
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Session expired");
  }
  const data = await res.json();
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, ...init } = options;
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  let access = !skipAuth ? tokenStorage.getAccessToken() : null;

  const doFetch = (token: string | null) => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...init, headers });
  };

  let res = await doFetch(access);

  if (res.status === 401 && !skipAuth && access) {
    try {
      access = await refreshAccessToken();
      res = await doFetch(access);
    } catch {
      tokenStorage.clear();
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Unauthorized");
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return data as T;
}

type ApiOptions = RequestInit & { skipAuth?: boolean };

export const api = {
  get: <T>(path: string, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    request<T>(path, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { tokenStorage };
