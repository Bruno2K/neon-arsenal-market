// ─── Repository Interface: Sellers ───────────────────────────────────────────

import type { Seller, SellerTransaction, ApplySellerData } from '../entities/Seller';

export interface ISellerRepository {
  getMe(): Promise<Seller>;
  apply(data: ApplySellerData): Promise<Seller>;
  approve(sellerId: string, isApproved: boolean): Promise<Seller>;
  findAll(): Promise<Seller[]>;
  findById(id: string): Promise<Seller>;
  getTransactions(): Promise<SellerTransaction[]>;
  getBalance(): Promise<{ balance: number }>;
}
