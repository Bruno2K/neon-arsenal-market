import { api } from "./client";
import type { User, Order, Seller } from "@/types/api";

export type Cs2ShImportSummary = {
  skipped: boolean;
  skipReason?: "missing_api_key";
  generationId: string | null;
  productsUpserted: number;
  schemaSkipped: number;
  listingsUpserted: number;
};

export type Cs2ShImportStatus = {
  running: boolean;
  lastResult: Cs2ShImportSummary | null;
};

export type Cs2ShImportStartResponse = Cs2ShImportStatus & {
  status: "started";
};

// ─── Users ────────────────────────────────────────────────────────────────────
export function listAdminUsers(): Promise<User[]> {
  return api.get<User[]>("/admin/users");
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export function listAdminOrders(): Promise<Order[]> {
  return api.get<Order[]>("/admin/orders");
}

// ─── Sellers ──────────────────────────────────────────────────────────────────
export function adminApproveSeller(
  id: string,
  isApproved: boolean,
): Promise<Seller> {
  return api.patch<Seller>(`/admin/sellers/${id}/approve`, { isApproved });
}

export function getCs2ShImportStatus(): Promise<Cs2ShImportStatus> {
  return api.get<Cs2ShImportStatus>("/admin/catalog/cs2sh-import");
}

export function startCs2ShImport(): Promise<Cs2ShImportStartResponse> {
  return api.post<Cs2ShImportStartResponse>("/admin/catalog/cs2sh-import");
}
