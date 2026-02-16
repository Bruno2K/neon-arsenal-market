import { Router } from "express";
import { adminController } from "./admin.controller.js";
import { authenticate, requireRole } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { approveSellerDto } from "../sellers/sellers.dto.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("ADMIN"));

router.get("/users", adminController.listUsers);
router.get("/orders", adminController.listOrders);
router.patch(
  "/sellers/:id/approve",
  validateBody(approveSellerDto),
  adminController.approveSeller
);

export const adminRoutes = router;
