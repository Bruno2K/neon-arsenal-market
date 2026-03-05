import { prisma } from "../../shared/database/index.js";
import { reviewsRepository } from "./reviews.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { CreateReviewInput, UpdateReviewInput } from "./reviews.dto.js";

export const reviewsService = {
  async listByProductId(productId: string) {
    return reviewsRepository.findManyByProductId(productId);
  },

  async getById(id: string) {
    const review = await reviewsRepository.findById(id);
    if (!review) throw new AppError(404, "Review not found");
    return review;
  },

  async create(userId: string, input: CreateReviewInput) {
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) throw new AppError(404, "Product not found");
    const existing = await prisma.review.findUnique({
      where: { productId_userId: { productId: input.productId, userId } },
    });
    if (existing) throw new AppError(409, "You already reviewed this product");
    return reviewsRepository.create({
      product: { connect: { id: input.productId } },
      user: { connect: { id: userId } },
      rating: input.rating,
      comment: input.comment,
    });
  },

  async update(id: string, userId: string, input: UpdateReviewInput) {
    const review = await reviewsRepository.findById(id);
    if (!review) throw new AppError(404, "Review not found");
    if (review.user.id !== userId) throw new AppError(403, "Not your review");
    return reviewsRepository.update(id, input);
  },

  async delete(id: string, userId: string) {
    const review = await reviewsRepository.findById(id);
    if (!review) throw new AppError(404, "Review not found");
    if (review.user.id !== userId) throw new AppError(403, "Not your review");
    await reviewsRepository.delete(id);
    return { success: true };
  },
};
