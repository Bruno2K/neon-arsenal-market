// ─── Infrastructure: SellerRepository ────────────────────────────────────────

import type { ISellerRepository } from '@/domain/sellers/repositories/ISellerRepository';
import type { Seller, SellerTransaction, ApplySellerData } from '@/domain/sellers/entities/Seller';
import { httpRequest } from '../http/HttpClient';

export class SellerRepository implements ISellerRepository {
  async getMe(): Promise<Seller> {
    return httpRequest<Seller>('/sellers/me');
  }

  async apply(data: ApplySellerData): Promise<Seller> {
    return httpRequest<Seller>('/sellers/apply', { method: 'POST', body: data });
  }

  // Admin endpoint: PATCH /sellers/:id/approve { isApproved: boolean }
  async approve(sellerId: string, isApproved: boolean): Promise<Seller> {
    return httpRequest<Seller>(`/sellers/${sellerId}/approve`, {
      method: 'PATCH',
      body: { isApproved },
    });
  }

  async findAll(): Promise<Seller[]> {
    return httpRequest<Seller[]>('/sellers');
  }

  async findById(id: string): Promise<Seller> {
    return httpRequest<Seller>(`/sellers/${id}`);
  }

  async getTransactions(): Promise<SellerTransaction[]> {
    return httpRequest<SellerTransaction[]>('/commissions/transactions');
  }

  async getBalance(): Promise<{ balance: number }> {
    return httpRequest<{ balance: number }>('/commissions/balance');
  }
}

export const sellerRepository = new SellerRepository();
