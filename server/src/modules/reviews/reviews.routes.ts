import { Router } from "express";
import { reviewsController } from "./reviews.controller.js";
import { authenticate, validateParams } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { createReviewDto, updateReviewDto, reviewIdParamsDto, productIdParamsDto } from "./reviews.dto.js";

const router = Router();

router.get("/product/:productId", validateParams(productIdParamsDto), reviewsController.listByProduct);
router.get("/:id", validateParams(reviewIdParamsDto), reviewsController.getById);

router.post(
  "/",
  authenticate,
  validateBody(createReviewDto),
  reviewsController.create
);
router.patch(
  "/:id",
  authenticate,
  validateParams(reviewIdParamsDto),
  validateBody(updateReviewDto),
  reviewsController.update
);
router.delete("/:id", authenticate, validateParams(reviewIdParamsDto), reviewsController.delete);

export const reviewsRoutes = router;
