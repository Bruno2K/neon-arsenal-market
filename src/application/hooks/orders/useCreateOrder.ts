import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderRepository } from '@/infrastructure/repositories/OrderRepository';
import type { CreateOrderData } from '@/domain/orders/entities/Order';

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderData) => orderRepository.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
