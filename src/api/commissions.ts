import { api } from "./client";
import type { CommissionBalance, SellerTransaction } from "@/types/api";

export function getCommissionBalance(): Promise<CommissionBalance> {
  return api.get<CommissionBalance>("/commissions/balance");
}

export function listCommissionTransactions(): Promise<SellerTransaction[]> {
  return api.get<SellerTransaction[]>("/commissions/transactions");
}
