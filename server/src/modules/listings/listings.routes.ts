import { Router } from "express";
import { listingsController } from "./listings.controller.js";
import { authenticate, requireRole, validateQuery, validateParams } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import {
  createListingDto,
  updateListingDto,
  updateListingPriceDto,
  listListingsQueryDto,
  listingIdParamsDto,
} from "./listings.dto.js";

const router = Router();

router.get("/", validateQuery(listListingsQueryDto), listingsController.list);
router.get("/:id", validateParams(listingIdParamsDto), listingsController.getById);

router.post(
  "/",
  authenticate,
  requireRole("SELLER"),
  validateBody(createListingDto),
  listingsController.create
);

router.patch(
  "/:id",
  authenticate,
  requireRole("SELLER", "ADMIN"),
  validateParams(listingIdParamsDto),
  validateBody(updateListingDto),
  listingsController.update
);

router.patch(
  "/:id/price",
  authenticate,
  requireRole("SELLER", "ADMIN"),
  validateParams(listingIdParamsDto),
  validateBody(updateListingPriceDto),
  listingsController.updatePrice
);

router.post(
  "/:id/reserve",
  validateParams(listingIdParamsDto),
  listingsController.reserve
);

router.post(
  "/:id/mark-sold",
  authenticate,
  requireRole("ADMIN"),
  validateParams(listingIdParamsDto),
  listingsController.markAsSold
);

router.post(
  "/:id/cancel",
  authenticate,
  requireRole("SELLER", "ADMIN"),
  validateParams(listingIdParamsDto),
  listingsController.cancel
);

router.get(
  "/seller/my-listings",
  authenticate,
  requireRole("SELLER"),
  listingsController.getBySeller
);

export const listingsRoutes = router;
