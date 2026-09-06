import type { Prisma } from "@prisma/client";
import { createdAtIdDescOrderBy } from "../../shared/pagination/cursor.js";

/**
 * Offset-mode catalog sorts for GET /listings (issue #93).
 * Applied in PostgreSQL to the full filtered set, then page/limit slices.
 * Cursor mode (#49) stays `createdAt DESC, id DESC` and ignores this whitelist.
 */
export const LISTING_SORTS = [
  "createdAt_desc",
  "price_asc",
  "price_desc",
  "float_asc",
  "float_desc",
] as const;

export type ListingSort = (typeof LISTING_SORTS)[number];

export const DEFAULT_LISTING_SORT: ListingSort = "createdAt_desc";

export function listingOrderBy(
  sort: ListingSort | undefined
): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort ?? DEFAULT_LISTING_SORT) {
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "desc" }];
    case "float_asc":
      return [{ floatValue: "asc" }, { id: "asc" }];
    case "float_desc":
      return [{ floatValue: "desc" }, { id: "desc" }];
    case "createdAt_desc":
      return [...createdAtIdDescOrderBy];
  }
}
