import { api } from "./client";
import type { Seller } from "@/types/api";

export function getSellerMe(): Promise<Seller> {
  return api.get<Seller>("/sellers/me");
}
