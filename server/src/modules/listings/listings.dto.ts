import { z } from "zod";

const LISTING_STATUSES = ["ACTIVE", "SOLD", "RESERVED", "CANCELED"] as const;

export const createListingDto = z.object({
  productId: z.string().min(1, "Product ID is required"),
  floatValue: z
    .number()
    .min(0, "Float value must be between 0 and 1")
    .max(1, "Float value must be between 0 and 1"),
  pattern: z.number().int().positive().optional(),
  price: z.number().positive("Price must be positive"),
  currency: z.string().default("USD"),
  tradeLockUntil: z.string().datetime().optional().or(z.date().optional()),
  steamAssetId: z.string().optional(),
});

export const updateListingDto = z.object({
  price: z.number().positive().optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  tradeLockUntil: z.string().datetime().optional().or(z.date().optional()).nullable(),
});

export const updateListingPriceDto = z.object({
  newPrice: z.number().positive("Price must be positive"),
});

export const listListingsQueryDto = z.object({
  productId: z.string().optional(),
  sellerId: z.string().optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minFloat: z.coerce.number().min(0).max(1).optional(),
  maxFloat: z.coerce.number().min(0).max(1).optional(),
  exterior: z.string().optional(),
  isStattrak: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const listingIdParamsDto = z.object({
  id: z.string().min(1, "Listing ID is required"),
});

export type CreateListingInput = z.infer<typeof createListingDto>;
export type UpdateListingInput = z.infer<typeof updateListingDto>;
export type UpdateListingPriceInput = z.infer<typeof updateListingPriceDto>;
export type ListListingsQuery = z.infer<typeof listListingsQueryDto>;
