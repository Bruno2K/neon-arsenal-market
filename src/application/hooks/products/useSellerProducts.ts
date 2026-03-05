import { useQuery } from '@tanstack/react-query';
import { productRepository } from '@/infrastructure/repositories/ProductRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';

export const sellerProductsKey = ['products', 'seller'] as const;

export function useSellerProducts() {
  return useQuery({
    queryKey: sellerProductsKey,
    queryFn: () => productRepository.findBySeller(),
    enabled: !!tokenStorage.getAccessToken(),
    staleTime: 1000 * 60 * 2,
  });
}
