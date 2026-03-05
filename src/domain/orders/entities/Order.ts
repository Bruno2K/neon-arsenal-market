// ─── Domain Entity: Order ────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';

export interface OrderItemSeller {
  id: string;
  storeName: string;
}

export interface OrderItemProduct {
  id: string;
  name: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  sellerId: string;
  quantity: number;
  priceSnapshot: number;
  product?: OrderItemProduct;
  seller?: OrderItemSeller;
}

export interface OrderCustomer {
  id: string;
  name: string;
  email: string;
}

export interface Order {
  id: string;
  customerId: string;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paypalOrderId?: string;
  createdAt: string;
  updatedAt: string;
  customer?: OrderCustomer;
  items: OrderItem[];
}

export interface CreateOrderData {
  items: Array<{ productId: string; quantity: number }>;
}
