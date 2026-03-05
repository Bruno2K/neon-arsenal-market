import { Router } from "express";
import { ordersController } from "./orders.controller.js";
import { authenticate, requireRole, validateParams } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { createOrderDto, updateOrderStatusDto, updateOrderTrackingDto, orderIdParamsDto } from "./orders.dto.js";

const router = Router();

router.post(
  "/",
  authenticate,
  requireRole("CUSTOMER"),
  validateBody(createOrderDto),
  ordersController.create
);
router.get("/", authenticate, ordersController.list);
router.get("/:id", authenticate, validateParams(orderIdParamsDto), ordersController.getById);
router.patch(
  "/:id/status",
  authenticate,
  validateParams(orderIdParamsDto),
  validateBody(updateOrderStatusDto),
  ordersController.updateStatus
);
router.patch(
  "/:id/tracking",
  authenticate,
  requireRole("SELLER", "ADMIN"),
  validateParams(orderIdParamsDto),
  validateBody(updateOrderTrackingDto),
  ordersController.updateTracking
);

export const ordersRoutes = router;
