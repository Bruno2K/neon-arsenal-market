import { api } from "./client";
import type { CreateReviewBody, Review, UpdateReviewBody } from "@/types/api";

function reviewPath(id: string): string {
  return `/reviews/${encodeURIComponent(id)}`;
}

/** GET /reviews/product/:productId — public list, newest first. */
export function listProductReviews(productId: string): Promise<Review[]> {
  return api.get<Review[]>(`/reviews/product/${encodeURIComponent(productId)}`);
}

/** GET /reviews/:id */
export function getReview(id: string): Promise<Review> {
  return api.get<Review>(reviewPath(id));
}

/** POST /reviews — authenticated; unique per (productId, userId). */
export function createReview(body: CreateReviewBody): Promise<Review> {
  return api.post<Review>("/reviews", body);
}

/** PATCH /reviews/:id — owner only. */
export function updateReview(
  id: string,
  body: UpdateReviewBody,
): Promise<Review> {
  return api.patch<Review>(reviewPath(id), body);
}

/** DELETE /reviews/:id — owner only. */
export function deleteReview(id: string): Promise<void> {
  return api.delete(reviewPath(id));
}
