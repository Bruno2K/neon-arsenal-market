import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productRepository } from '@/infrastructure/repositories/ProductRepository';
import type { UpdateProductData } from '@/domain/products/entities/Product';
import { productKey } from './useProduct';
import { sellerProductsKey } from './useSellerProducts';

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) =>
      productRepository.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: productKey(id) });
      queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
      queryClient.invalidateQueries({ queryKey: sellerProductsKey });
    },
  });
}
