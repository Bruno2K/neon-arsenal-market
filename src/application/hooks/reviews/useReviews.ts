import { useQuery } from '@tanstack/react-query';
import { reviewRepository } from '@/infrastructure/repositories/ReviewRepository';

export const reviewsKey = (productId: string) => ['reviews', productId] as const;

export function useReviews(productId: string) {
  return useQuery({
    queryKey: reviewsKey(productId),
    queryFn: () => reviewRepository.findByProduct(productId),
    enabled: !!productId,
  });
}
