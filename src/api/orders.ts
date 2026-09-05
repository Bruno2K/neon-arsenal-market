import { api } from "./client";
import type { Order } from "@/types/api";

export function createOrder(
  body: { items: { listingId: string }[] },
  options: { idempotencyKey: string },
): Promise<Order & { totalAmount?: number }> {
  return api.post<Order & { totalAmount?: number }>("/orders", body, {
    headers: { "Idempotency-Key": options.idempotencyKey },
  });
}

export function listOrders(): Promise<Order[]> {
  return api.get<Order[]>("/orders");
}

export function getOrder(id: string): Promise<Order> {
  return api.get<Order>(`/orders/${id}`);
}

export function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<Order> {
  return api.patch<Order>(`/orders/${orderId}/status`, { status });
}

export function updateOrderTracking(
  orderId: string,
  body: { trackingCode?: string; trackingCarrier?: string },
): Promise<Order> {
  return api.patch<Order>(`/orders/${orderId}/tracking`, body);
}
