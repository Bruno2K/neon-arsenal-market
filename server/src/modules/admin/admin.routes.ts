import { Router } from "express";
import { adminController } from "./admin.controller.js";
import { authenticate, requireRole, validateQuery } from "../../shared/middlewares/index.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { approveSellerDto } from "../sellers/sellers.dto.js";
import { listOrdersQueryDto } from "../orders/orders.dto.js";
import { listAuditLogsQueryDto } from "../audit/audit.dto.js";

const router = Router();

router.use(authenticate);
router.use(requireRole("ADMIN"));

router.get("/users", adminController.listUsers);
router.get("/orders", validateQuery(listOrdersQueryDto), adminController.listOrders);
router.get("/audit-logs", validateQuery(listAuditLogsQueryDto), adminController.listAuditLogs);
router.patch(
  "/sellers/:id/approve",
  validateBody(approveSellerDto),
  adminController.approveSeller
);

export const adminRoutes = router;
