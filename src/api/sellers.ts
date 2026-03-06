import { api } from "./client";
import type { Seller } from "@/types/api";

export function getSellerMe(): Promise<Seller> {
  return api.get<Seller>("/sellers/me");
}

export function listSellers(): Promise<Seller[]> {
  return api.get<Seller[]>("/sellers");
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
