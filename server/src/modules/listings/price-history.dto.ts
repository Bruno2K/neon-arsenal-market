import { z } from "zod";

export const listPriceHistoryQueryDto = z.object({
  listingId: z.string().min(1, "Listing ID is required"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListPriceHistoryQuery = z.infer<typeof listPriceHistoryQueryDto>;
