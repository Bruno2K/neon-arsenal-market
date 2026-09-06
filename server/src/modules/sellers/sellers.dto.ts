import { z } from "zod";
import { STORE_NAME_MAX, resourceIdSchema } from "../../shared/validation/httpLimits.js";

export const applySellerDto = z.object({
  storeName: z.string().min(1, "Store name is required").max(STORE_NAME_MAX),
  commissionRate: z.number().min(0).max(1).optional().default(0.1),
});

export const updateSellerDto = z.object({
  storeName: z.string().min(1).max(STORE_NAME_MAX).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
});

export const approveSellerDto = z.object({
  isApproved: z.boolean(),
});

export const sellerIdParamsDto = z.object({
  id: resourceIdSchema("Seller ID"),
});

export type ApplySellerInput = z.infer<typeof applySellerDto>;
export type UpdateSellerInput = z.infer<typeof updateSellerDto>;
