import { api } from "./client";
import type { PriceHistory } from "@/types/api";

export function getPriceHistory(listingId: string): Promise<PriceHistory[]> {
  return api.get<PriceHistory[]>(`/listings/${listingId}/price-history`);
}
