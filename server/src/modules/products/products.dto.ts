import { z } from "zod";
import { CURSOR_MAX_LENGTH } from "../../shared/pagination/cursor.js";
import { SEARCH_MAX, URL_MAX, resourceIdSchema } from "../../shared/validation/httpLimits.js";

const EXTERIOR_TYPES = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"] as const;
const RARITY_TYPES = [
  "Consumer Grade",
  "Industrial Grade",
  "Mil-Spec Grade",
  "Restricted",
  "Classified",
  "Covert",
  "Exceedingly Rare",
  "Contraband",
  "Extraordinary",
] as const;

export const createProductDto = z.object({
  game: z.string().min(1, "Game is required").max(SEARCH_MAX).default("CS2"),
  weapon: z.string().min(1, "Weapon is required").max(SEARCH_MAX),
  skinName: z.string().min(1, "Skin name is required").max(SEARCH_MAX),
  rarity: z.enum(RARITY_TYPES),
  exterior: z.enum(EXTERIOR_TYPES),
  collection: z.string().max(SEARCH_MAX).optional(),
  imageUrl: z.string().url().max(URL_MAX).optional().or(z.literal("")),
  isStattrak: z.boolean().default(false),
  isSouvenir: z.boolean().default(false),
});

export const updateProductDto = z.object({
  game: z.string().min(1).max(SEARCH_MAX).optional(),
  weapon: z.string().min(1).max(SEARCH_MAX).optional(),
  skinName: z.string().min(1).max(SEARCH_MAX).optional(),
  rarity: z.enum(RARITY_TYPES).optional(),
  exterior: z.enum(EXTERIOR_TYPES).optional(),
  collection: z.string().max(SEARCH_MAX).optional().nullable(),
  imageUrl: z.string().url().max(URL_MAX).optional().or(z.literal("")).nullable(),
  isStattrak: z.boolean().optional(),
  isSouvenir: z.boolean().optional(),
});

export const listProductsQueryDto = z.object({
  game: z.string().optional(),
  weapon: z.string().optional(),
  exterior: z.enum(EXTERIOR_TYPES).optional(),
  rarity: z.enum(RARITY_TYPES).optional(),
  isStattrak: z.coerce.boolean().optional(),
  search: z.string().max(SEARCH_MAX).optional(),
  cursor: z.string().max(CURSOR_MAX_LENGTH).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const productIdParamsDto = z.object({
  id: resourceIdSchema("Product ID"),
});

export type CreateProductInput = z.infer<typeof createProductDto>;
export type UpdateProductInput = z.infer<typeof updateProductDto>;
export type ListProductsQuery = z.infer<typeof listProductsQueryDto>;
