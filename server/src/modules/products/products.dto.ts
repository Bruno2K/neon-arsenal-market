import { z } from "zod";

const VALID_CATEGORIES = ["rifles", "pistols", "knives", "gloves", "accounts", "services", "other"] as const;

export const createProductDto = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().min(0, "Stock must be non-negative"),
  imageUrl: z.string().url("Invalid image URL").optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
});

export const updateProductDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url("Invalid image URL").nullable().optional(),
  category: z.enum(VALID_CATEGORIES).nullable().optional(),
});

export const listProductsQueryDto = z.object({
  sellerId: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateProductInput = z.infer<typeof createProductDto>;
export type UpdateProductInput = z.infer<typeof updateProductDto>;
export type ListProductsQuery = z.infer<typeof listProductsQueryDto>;
