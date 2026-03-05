// ─── Domain Entity: Seller ───────────────────────────────────────────────────

export interface SellerUser {
  id: string;
  name: string;
  email: string;
}

export interface Seller {
  id: string;
  userId: string;
  storeName: string;
  commissionRate: number;
  balance: number;
  rating: number;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  user?: SellerUser;
}

export interface SellerTransaction {
  id: string;
  sellerId: string;
  orderId: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: string;
  createdAt: string;
}

export interface ApplySellerData {
  storeName: string;
  commissionRate?: number;
}
