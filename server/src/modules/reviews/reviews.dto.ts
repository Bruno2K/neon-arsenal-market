import { z } from "zod";

export const createReviewDto = z.object({
  productId: z.string().min(1, "Product ID is required"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const updateReviewDto = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewDto>;
export type UpdateReviewInput = z.infer<typeof updateReviewDto>;
