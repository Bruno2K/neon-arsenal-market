export const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";

const DEV_FRONTEND_ORIGINS = [
  DEFAULT_FRONTEND_ORIGIN,
  "http://127.0.0.1:5173",
];

export function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    const trimmed = origin.trim().replace(/\/+$/, "");
    return trimmed === "" ? null : trimmed;
  }
}

export function getAllowedCorsOrigins(frontendUrl = process.env.FRONTEND_URL): string[] {
  const configuredOrigins = (frontendUrl ?? DEFAULT_FRONTEND_ORIGIN)
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));

  return [...new Set([...configuredOrigins, ...DEV_FRONTEND_ORIGINS])];
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins = getAllowedCorsOrigins()
): boolean {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowedOrigins.includes(normalized);
}
