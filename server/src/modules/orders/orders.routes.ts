import { Router } from "express";
import { ordersController } from "./orders.controller.js";
import { authenticate, requireRole } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { createOrderDto, updateOrderStatusDto } from "./orders.dto.js";

const router = Router();

router.post(
  "/",
  authenticate,
  requireRole("CUSTOMER"),
  validateBody(createOrderDto),
  ordersController.create
);
router.get("/", authenticate, ordersController.list);
router.get("/:id", authenticate, ordersController.getById);
router.patch(
  "/:id/status",
  authenticate,
  validateBody(updateOrderStatusDto),
  ordersController.updateStatus
);

export const ordersRoutes = router;
