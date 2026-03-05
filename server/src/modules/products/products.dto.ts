import { z } from "zod";

const EXTERIOR_TYPES = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"] as const;
const RARITY_TYPES = ["Consumer Grade", "Industrial Grade", "Mil-Spec Grade", "Restricted", "Classified", "Covert", "Exceedingly Rare"] as const;

export const createProductDto = z.object({
  game: z.string().min(1, "Game is required").default("CS2"),
  weapon: z.string().min(1, "Weapon is required"),
  skinName: z.string().min(1, "Skin name is required"),
  rarity: z.enum(RARITY_TYPES),
  exterior: z.enum(EXTERIOR_TYPES),
  collection: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isStattrak: z.boolean().default(false),
  isSouvenir: z.boolean().default(false),
});

export const updateProductDto = z.object({
  game: z.string().min(1).optional(),
  weapon: z.string().min(1).optional(),
  skinName: z.string().min(1).optional(),
  rarity: z.enum(RARITY_TYPES).optional(),
  exterior: z.enum(EXTERIOR_TYPES).optional(),
  collection: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  isStattrak: z.boolean().optional(),
  isSouvenir: z.boolean().optional(),
});

export const listProductsQueryDto = z.object({
  game: z.string().optional(),
  weapon: z.string().optional(),
  exterior: z.enum(EXTERIOR_TYPES).optional(),
  rarity: z.enum(RARITY_TYPES).optional(),
  isStattrak: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const productIdParamsDto = z.object({
  id: z.string().min(1, "Product ID is required"),
});

export type CreateProductInput = z.infer<typeof createProductDto>;
export type UpdateProductInput = z.infer<typeof updateProductDto>;
export type ListProductsQuery = z.infer<typeof listProductsQueryDto>;
