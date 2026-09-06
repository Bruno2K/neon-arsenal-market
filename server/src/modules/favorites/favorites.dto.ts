import { z } from "zod";
import { resourceIdSchema } from "../../shared/validation/httpLimits.js";

export const createFavoriteDto = z.object({
  listingId: resourceIdSchema("Listing ID"),
});

export const favoriteListingParamsDto = z.object({
  listingId: resourceIdSchema("Listing ID"),
});

export type CreateFavoriteInput = z.infer<typeof createFavoriteDto>;
