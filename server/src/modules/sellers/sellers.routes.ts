import { Router } from "express";
import { sellersController } from "./sellers.controller.js";
import { authenticate, requireRole, validateParams } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { applySellerDto, updateSellerDto, approveSellerDto, sellerIdParamsDto } from "./sellers.dto.js";

const router = Router();

router.get("/", sellersController.list);
router.get("/me", authenticate, sellersController.getMe);
router.post("/apply", authenticate, validateBody(applySellerDto), sellersController.apply);
router.get("/:id", validateParams(sellerIdParamsDto), sellersController.getById);
router.patch(
  "/:id",
  authenticate,
  validateParams(sellerIdParamsDto),
  validateBody(updateSellerDto),
  sellersController.update
);
router.patch(
  "/:id/approve",
  authenticate,
  requireRole("ADMIN"),
  validateParams(sellerIdParamsDto),
  validateBody(approveSellerDto),
  sellersController.approve
);

export const sellersRoutes = router;
