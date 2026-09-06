import { Router } from "express";
import { authenticate, requireRole, validateParams } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { favoritesController } from "./favorites.controller.js";
import { createFavoriteDto, favoriteListingParamsDto } from "./favorites.dto.js";

const router = Router();

router.get("/", authenticate, requireRole("CUSTOMER"), favoritesController.list);
router.post(
  "/",
  authenticate,
  requireRole("CUSTOMER"),
  validateBody(createFavoriteDto),
  favoritesController.create
);
router.delete(
  "/:listingId",
  authenticate,
  requireRole("CUSTOMER"),
  validateParams(favoriteListingParamsDto),
  favoritesController.remove
);

export const favoritesRoutes = router;
