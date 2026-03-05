import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productRepository } from '@/infrastructure/repositories/ProductRepository';
import type { CreateProductData } from '@/domain/products/entities/Product';
import { sellerProductsKey } from './useSellerProducts';

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductData) => productRepository.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: sellerProductsKey });
    },
  });
}
