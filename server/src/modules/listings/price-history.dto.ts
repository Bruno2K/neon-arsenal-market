import { z } from "zod";
import { resourceIdSchema } from "../../shared/validation/httpLimits.js";

export const listPriceHistoryQueryDto = z.object({
  listingId: resourceIdSchema("Listing ID"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type ListPriceHistoryQuery = z.infer<typeof listPriceHistoryQueryDto>;
