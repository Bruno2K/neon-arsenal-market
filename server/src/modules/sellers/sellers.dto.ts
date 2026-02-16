import { z } from "zod";

export const applySellerDto = z.object({
  storeName: z.string().min(1, "Store name is required"),
  commissionRate: z.number().min(0).max(1).optional().default(0.1),
});

export const updateSellerDto = z.object({
  storeName: z.string().min(1).optional(),
  commissionRate: z.number().min(0).max(1).optional(),
});

export const approveSellerDto = z.object({
  isApproved: z.boolean(),
});

export type ApplySellerInput = z.infer<typeof applySellerDto>;
export type UpdateSellerInput = z.infer<typeof updateSellerDto>;
