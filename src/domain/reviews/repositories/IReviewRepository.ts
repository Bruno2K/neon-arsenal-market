// ─── Repository Interface: Reviews ───────────────────────────────────────────

import type { Review, CreateReviewData } from '../entities/Review';

export interface IReviewRepository {
  findByProduct(productId: string): Promise<Review[]>;
  create(data: CreateReviewData): Promise<Review>;
  delete(reviewId: string): Promise<void>;
}
