// ─── Repository Interface: Orders ────────────────────────────────────────────

import type { Order, CreateOrderData, OrderStatus } from '../entities/Order';

export interface IOrderRepository {
  create(data: CreateOrderData): Promise<Order>;
  findById(id: string): Promise<Order>;
  findByCustomer(): Promise<Order[]>;
  findBySeller(): Promise<Order[]>;
  findAll(filters?: { status?: OrderStatus }): Promise<Order[]>;
  updateStatus(id: string, status: OrderStatus): Promise<Order>;
}
