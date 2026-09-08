import { z } from "zod";
import { CURSOR_MAX_LENGTH } from "../../shared/pagination/cursor.js";
import { LISTING_STATUSES } from "../../shared/types/roles.js";
import {
  SEARCH_MAX,
  STEAM_ASSET_ID_MAX,
  resourceIdSchema,
} from "../../shared/validation/httpLimits.js";
import { LISTING_SORTS } from "./listings.sort.js";
import { MONEY_CURRENCY } from "../../shared/money/policy.js";

export const createListingDto = z.object({
  productId: resourceIdSchema("Product ID"),
  floatValue: z
    .number()
    .min(0, "Float value must be between 0 and 1")
    .max(1, "Float value must be between 0 and 1"),
  pattern: z.number().int().positive().optional(),
  price: z.number().positive("Price must be positive"),
  currency: z.literal(MONEY_CURRENCY).default(MONEY_CURRENCY),
  tradeLockUntil: z.string().datetime().optional().or(z.date().optional()),
  steamAssetId: z.string().max(STEAM_ASSET_ID_MAX).optional(),
});

export const updateListingDto = z.object({
  price: z.number().positive().optional(),
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
  exterior: z.string().max(SEARCH_MAX).optional(),
  isStattrak: z.coerce.boolean().optional(),
  weapon: z.string().max(SEARCH_MAX).optional(),
  rarity: z.string().max(SEARCH_MAX).optional(),
  game: z.string().max(SEARCH_MAX).optional(),
  /**
   * Offset-mode catalog sort. Default `createdAt_desc`. Ignored when `cursor` is
   * present (keyset remains createdAt+id). Applied in SQL to the full filter set.
   */
  sort: z.enum(LISTING_SORTS).optional(),
  /**
   * Opaque keyset cursor (`createdAt` + `id`). When present (including empty = first
   * keyset page), `page` is ignored. Limit remains 1–100, default 20.
   */
  cursor: z.string().max(CURSOR_MAX_LENGTH).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const listingIdParamsDto = z.object({
  id: resourceIdSchema("Listing ID"),
});

export type CreateListingInput = z.infer<typeof createListingDto>;
export type UpdateListingInput = z.infer<typeof updateListingDto>;
export type UpdateListingPriceInput = z.infer<typeof updateListingPriceDto>;
export type ListListingsQuery = z.infer<typeof listListingsQueryDto>;
