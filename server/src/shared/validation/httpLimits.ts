import { z } from "zod";

export const RESOURCE_ID_MAX = 128;
export const PERSON_NAME_MAX = 120;
export const STORE_NAME_MAX = 120;
export const REVIEW_COMMENT_MAX = 2000;
export const TRACKING_MAX = 64;
export const CURRENCY_MAX = 8;
export const URL_MAX = 2048;
export const STEAM_ASSET_ID_MAX = 128;
export const SEARCH_MAX = 200;

export function resourceIdSchema(label: string) {
  return z.string().min(1, `${label} is required`).max(RESOURCE_ID_MAX);
}
