import { useQuery } from '@tanstack/react-query';
import { productRepository } from '@/infrastructure/repositories/ProductRepository';

export const productKey = (id: string) => ['products', 'detail', id] as const;

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKey(id),
    queryFn: () => productRepository.findById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
}
