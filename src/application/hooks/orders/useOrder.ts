import { useQuery } from '@tanstack/react-query';
import { orderRepository } from '@/infrastructure/repositories/OrderRepository';

export const orderKey = (id: string) => ['orders', 'detail', id] as const;

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: () => orderRepository.findById(id),
    enabled: !!id,
  });
}
