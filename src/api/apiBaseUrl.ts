type ApiUrlEnv = {
  API_URL?: string;
  VITE_API_URL?: string;
};

const DEFAULT_API_BASE = "http://localhost:3001";

function normalizeApiBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

/**
 * Resolves the browser API origin from build-time env.
 * Prefer `API_URL` (no public framework prefix) so Vercel can store it as Config.
 * `VITE_API_URL` remains a local/dev fallback.
 */
export function resolveApiBaseUrl(env: ApiUrlEnv = {}): string {
  return (
    normalizeApiBaseUrl(env.API_URL) ||
    normalizeApiBaseUrl(env.VITE_API_URL) ||
    DEFAULT_API_BASE
  );
}
