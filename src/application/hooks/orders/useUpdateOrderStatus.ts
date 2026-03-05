import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderRepository } from '@/infrastructure/repositories/OrderRepository';
import type { OrderStatus } from '@/domain/orders/entities/Order';
import { orderKey } from './useOrder';

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      orderRepository.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: orderKey(id) });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
