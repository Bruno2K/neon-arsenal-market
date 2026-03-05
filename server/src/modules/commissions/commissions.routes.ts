import { Router } from "express";
import { commissionsController } from "./commissions.controller.js";
import { authenticate, requireRole } from "../../shared/middlewares/index.js";

const router = Router();

router.use(authenticate);
router.get("/transactions", requireRole("SELLER", "ADMIN"), commissionsController.listTransactions);
router.get("/balance", requireRole("SELLER"), commissionsController.getBalance);

export const commissionsRoutes = router;
