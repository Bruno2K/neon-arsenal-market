import { api } from "./client";
import type { User, Order, Seller } from "@/types/api";

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
