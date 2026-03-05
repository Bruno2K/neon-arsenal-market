import { Router } from "express";
import { priceHistoryController } from "./price-history.controller.js";
import { z } from "zod";
import { validateParams } from "../../shared/middlewares/validateParams.js";

const listingIdParamsDto = z.object({
  listingId: z.string().min(1, "Listing ID is required"),
});

const router = Router();

router.get("/:listingId/price-history", validateParams(listingIdParamsDto), priceHistoryController.getHistory);

export const priceHistoryRoutes = router;
