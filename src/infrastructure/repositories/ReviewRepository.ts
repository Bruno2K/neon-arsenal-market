// ─── Infrastructure: ReviewRepository ────────────────────────────────────────

import type { IReviewRepository } from '@/domain/reviews/repositories/IReviewRepository';
import type { Review, CreateReviewData } from '@/domain/reviews/entities/Review';
import { httpRequest } from '../http/HttpClient';

export class ReviewRepository implements IReviewRepository {
  async findByProduct(productId: string): Promise<Review[]> {
    return httpRequest<Review[]>(`/reviews/product/${productId}`);
  }

  async create(data: CreateReviewData): Promise<Review> {
    return httpRequest<Review>('/reviews', { method: 'POST', body: data });
  }

  async delete(reviewId: string): Promise<void> {
    await httpRequest<void>(`/reviews/${reviewId}`, { method: 'DELETE' });
  }
}

export const reviewRepository = new ReviewRepository();
