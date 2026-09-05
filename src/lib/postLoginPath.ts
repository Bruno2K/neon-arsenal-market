import type { Role } from "@/types/api";

export const CHECKOUT_BUYER_ONLY_COPY =
  "Checkout é exclusivo para contas de comprador.";

export interface PostLoginDestination {
  path: string;
  notice?: string;
}

const AUTH_PAGES = new Set(["/login", "/register"]);

export function homePathForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "SELLER") return "/seller";
  return "/";
}

export function fromPathFromState(state: unknown): string | undefined {
  if (!state || typeof state !== "object") return undefined;
  const from = (state as { from?: unknown }).from;
  if (typeof from === "string") return from;
  if (from && typeof from === "object" && "pathname" in from) {
    const pathname = (from as { pathname?: unknown }).pathname;
    if (typeof pathname === "string") return pathname;
  }
  return undefined;
}

export function normalizeInternalPath(from?: string | null): string {
  if (from == null) return "/";
  const trimmed = from.trim();
  if (trimmed === "") return "/";
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("://")
  ) {
    return "/";
  }

  const pathOnly = trimmed.split(/[?#]/, 1)[0] ?? "/";
  const collapsed =
    pathOnly.length > 1 ? pathOnly.replace(/\/+$/, "") : pathOnly;
  if (collapsed === "" || AUTH_PAGES.has(collapsed)) return "/";
  return collapsed;
}

function isSellerPath(path: string): boolean {
  return path === "/seller" || path.startsWith("/seller/");
}

function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function isCheckoutPath(path: string): boolean {
  return path === "/checkout";
}

export function postLoginPath(
  role: Role,
  from?: string | null,
): PostLoginDestination {
  const path = normalizeInternalPath(from);

  if (path === "/") {
    return { path: homePathForRole(role) };
  }

  if (isSellerPath(path) && role !== "SELLER") {
    return { path: homePathForRole(role) };
  }

  if (isAdminPath(path) && role !== "ADMIN") {
    return { path: homePathForRole(role) };
  }

  if (isCheckoutPath(path) && role !== "CUSTOMER") {
    return {
      path: homePathForRole(role),
      notice: CHECKOUT_BUYER_ONLY_COPY,
    };
  }

  return { path };
}
