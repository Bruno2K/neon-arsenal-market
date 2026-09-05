import { api } from "./client";
import type { Seller } from "@/types/api";

export function getSellerMe(): Promise<Seller> {
  return api.get<Seller>("/sellers/me");
}

export function listSellers(params?: {
  approved?: boolean;
}): Promise<Seller[]> {
  const search = new URLSearchParams();
  if (typeof params?.approved === "boolean") {
    search.set("approved", String(params.approved));
  }
  const qs = search.toString();
  return api.get<Seller[]>(`/sellers${qs ? `?${qs}` : ""}`);
}

export function getSellerById(id: string): Promise<Seller> {
  return api.get<Seller>(`/sellers/${id}`);
}

export function approveSeller(
  id: string,
  isApproved: boolean,
): Promise<Seller> {
  return api.patch<Seller>(`/sellers/${id}/approve`, { isApproved });
}
