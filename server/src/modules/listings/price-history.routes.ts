import { Router } from "express";
import { priceHistoryController } from "./price-history.controller.js";
import { z } from "zod";
import { validateParams } from "../../shared/middlewares/validateParams.js";
import { resourceIdSchema } from "../../shared/validation/httpLimits.js";

const listingIdParamsDto = z.object({
  listingId: resourceIdSchema("Listing ID"),
});

const router = Router();

router.get("/:listingId/price-history", validateParams(listingIdParamsDto), priceHistoryController.getHistory);

export const priceHistoryRoutes = router;
