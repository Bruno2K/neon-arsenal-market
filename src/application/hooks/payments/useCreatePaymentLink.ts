import { useMutation } from '@tanstack/react-query';
import { paymentRepository } from '@/infrastructure/repositories/PaymentRepository';

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: (orderId: string) => paymentRepository.createPaymentLink(orderId),
    onSuccess: (data) => {
      // Redirect user to PayPal approval page
      window.location.href = data.approvalUrl;
    },
  });
}
