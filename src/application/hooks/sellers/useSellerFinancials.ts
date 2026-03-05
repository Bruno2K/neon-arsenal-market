import { useQuery } from '@tanstack/react-query';
import { sellerRepository } from '@/infrastructure/repositories/SellerRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';

export const sellerTransactionsKey = ['sellers', 'transactions'] as const;
export const sellerBalanceKey      = ['sellers', 'balance']      as const;

export function useSellerTransactions() {
  return useQuery({
    queryKey: sellerTransactionsKey,
    queryFn: () => sellerRepository.getTransactions(),
    enabled: !!tokenStorage.getAccessToken(),
  });
}

export function useSellerBalance() {
  return useQuery({
    queryKey: sellerBalanceKey,
    queryFn: () => sellerRepository.getBalance(),
    enabled: !!tokenStorage.getAccessToken(),
  });
}
