import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerRepository } from '@/infrastructure/repositories/SellerRepository';
import { allSellersKey } from './useSeller';

export function useApproveSeller() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sellerId, isApproved }: { sellerId: string; isApproved: boolean }) =>
      sellerRepository.approve(sellerId, isApproved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allSellersKey });
    },
  });
}
