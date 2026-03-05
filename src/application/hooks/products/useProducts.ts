import { useQuery } from '@tanstack/react-query';
import { productRepository } from '@/infrastructure/repositories/ProductRepository';
import type { ProductListParams } from '@/domain/products/entities/Product';

export const productsKey = (params?: ProductListParams) => ['products', 'list', params] as const;

export function useProducts(params?: ProductListParams) {
  return useQuery({
    queryKey: productsKey(params),
    queryFn: () => productRepository.findMany(params),
    staleTime: 1000 * 60 * 2,
  });
}
