// ─── Infrastructure: OrderRepository ────────────────────────────────────────

import type { IOrderRepository } from '@/domain/orders/repositories/IOrderRepository';
import type { Order, CreateOrderData, OrderStatus } from '@/domain/orders/entities/Order';
import { httpRequest } from '../http/HttpClient';

export class OrderRepository implements IOrderRepository {
  async create(data: CreateOrderData): Promise<Order> {
    return httpRequest<Order>('/orders', { method: 'POST', body: data });
  }

  async findById(id: string): Promise<Order> {
    return httpRequest<Order>(`/orders/${id}`);
  }

  // The backend GET /orders resolves differently per role:
  // CUSTOMER → returns customer orders | SELLER → returns seller orders | ADMIN → all
  async findByCustomer(): Promise<Order[]> {
    return httpRequest<Order[]>('/orders');
  }

  async findBySeller(): Promise<Order[]> {
    return httpRequest<Order[]>('/orders');
  }

  async findAll(filters?: { status?: OrderStatus }): Promise<Order[]> {
    const qs = filters?.status ? `?status=${filters.status}` : '';
    return httpRequest<Order[]>(`/orders${qs}`);
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return httpRequest<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }
}

export const orderRepository = new OrderRepository();
