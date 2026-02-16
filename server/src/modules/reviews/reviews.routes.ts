import { Router } from "express";
import { reviewsController } from "./reviews.controller.js";
import { authenticate } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { createReviewDto, updateReviewDto } from "./reviews.dto.js";

const router = Router();

router.get("/product/:productId", reviewsController.listByProduct);
router.get("/:id", reviewsController.getById);

router.post(
  "/",
  authenticate,
  validateBody(createReviewDto),
  reviewsController.create
);
router.patch(
  "/:id",
  authenticate,
  validateBody(updateReviewDto),
  reviewsController.update
);
router.delete("/:id", authenticate, reviewsController.delete);

export const reviewsRoutes = router;
