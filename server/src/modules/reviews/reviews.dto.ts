import { z } from "zod";
import { REVIEW_COMMENT_MAX, resourceIdSchema } from "../../shared/validation/httpLimits.js";

export const createReviewDto = z.object({
  productId: resourceIdSchema("Product ID"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(REVIEW_COMMENT_MAX).optional(),
});

export const updateReviewDto = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(REVIEW_COMMENT_MAX).optional(),
});

export const reviewIdParamsDto = z.object({
  id: resourceIdSchema("Review ID"),
});

export const productIdParamsDto = z.object({
  productId: resourceIdSchema("Product ID"),
});

export type CreateReviewInput = z.infer<typeof createReviewDto>;
export type UpdateReviewInput = z.infer<typeof updateReviewDto>;
