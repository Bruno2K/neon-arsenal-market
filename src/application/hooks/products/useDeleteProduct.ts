import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productRepository } from '@/infrastructure/repositories/ProductRepository';
import { sellerProductsKey } from './useSellerProducts';

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productRepository.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: sellerProductsKey });
    },
  });
}
