import { useQuery } from '@tanstack/react-query';
import { sellerRepository } from '@/infrastructure/repositories/SellerRepository';
import { tokenStorage } from '@/infrastructure/http/HttpClient';

export const sellerMeKey  = ['sellers', 'me']  as const;
export const allSellersKey = ['sellers', 'all'] as const;

export function useSellerMe() {
  return useQuery({
    queryKey: sellerMeKey,
    queryFn: () => sellerRepository.getMe(),
    enabled: !!tokenStorage.getAccessToken(),
    retry: false,
  });
}

export function useAllSellers() {
  return useQuery({
    queryKey: allSellersKey,
    queryFn: () => sellerRepository.findAll(),
    enabled: !!tokenStorage.getAccessToken(),
  });
}
