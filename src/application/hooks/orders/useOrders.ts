import { useQuery } from '@tanstack/react-query';
import { orderRepository } from '@/infrastructure/repositories/OrderRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';

export const customerOrdersKey = ['orders', 'customer'] as const;
export const sellerOrdersKey    = ['orders', 'seller']   as const;
export const allOrdersKey       = ['orders', 'all']      as const;

export function useCustomerOrders() {
  return useQuery({
    queryKey: customerOrdersKey,
    queryFn: () => orderRepository.findByCustomer(),
    enabled: !!tokenStorage.getAccessToken(),
  });
}

export function useSellerOrders() {
  return useQuery({
    queryKey: sellerOrdersKey,
    queryFn: () => orderRepository.findBySeller(),
    enabled: !!tokenStorage.getAccessToken(),
  });
}

export function useAllOrders() {
  return useQuery({
    queryKey: allOrdersKey,
    queryFn: () => orderRepository.findAll(),
    enabled: !!tokenStorage.getAccessToken(),
  });
}
