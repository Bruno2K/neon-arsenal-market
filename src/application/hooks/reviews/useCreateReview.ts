import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewRepository } from '@/infrastructure/repositories/ReviewRepository';
import type { CreateReviewData } from '@/domain/reviews/entities/Review';
import { reviewsKey } from './useReviews';

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReviewData) => reviewRepository.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: reviewsKey(data.productId) });
    },
  });
}
