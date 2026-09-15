import { api } from "./client";
import type { Seller, PublicSeller } from "@/types/api";

export function getSellerMe(): Promise<Seller> {
  return api.get<Seller>("/sellers/me");
}

/**
 * AUD-008 (PR11): public, unauthenticated, always approved-only. Server no
 * longer accepts a client-controlled approval filter. Full rows for ADMIN
 * management live at `listAdminSellers` (`@/api/admin`).
 */
export function listSellers(): Promise<PublicSeller[]> {
  return api.get<PublicSeller[]>("/sellers");
}

export function getSellerById(id: string): Promise<PublicSeller> {
  return api.get<PublicSeller>(`/sellers/${id}`);
}

export function applySeller(body: { storeName: string }): Promise<Seller> {
  return api.post<Seller>("/sellers/apply", { storeName: body.storeName });
}

export function approveSeller(
  id: string,
  isApproved: boolean,
): Promise<Seller> {
  return api.patch<Seller>(`/sellers/${id}/approve`, { isApproved });
}
