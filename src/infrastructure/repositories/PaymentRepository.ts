// ─── Infrastructure: PaymentRepository ───────────────────────────────────────

import type { IPaymentRepository, PaymentLink } from '@/domain/payments/repositories/IPaymentRepository';
import { httpRequest } from '../http/HttpClient';

export class PaymentRepository implements IPaymentRepository {
  async createPaymentLink(orderId: string): Promise<PaymentLink> {
    return httpRequest<PaymentLink>('/payments/create-link', {
      method: 'POST',
      body: { orderId },
    });
  }

  async confirmPayment(orderId: string): Promise<void> {
    await httpRequest<void>(`/payments/confirm/${orderId}`, { method: 'POST' });
  }
}

export const paymentRepository = new PaymentRepository();
