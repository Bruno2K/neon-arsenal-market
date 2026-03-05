// ─── Repository Interface: Payments ──────────────────────────────────────────

export interface PaymentLink {
  orderId: string;
  paypalOrderId?: string;
  approvalUrl: string;
}

export interface IPaymentRepository {
  createPaymentLink(orderId: string): Promise<PaymentLink>;
  confirmPayment(orderId: string): Promise<void>;
}
