import { Router } from "express";
import { paymentsController } from "./payments.controller.js";
import { authenticate } from "../../shared/middlewares/authenticate.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { createPaymentDto } from "./payments.dto.js";

const router = Router();

router.post(
  "/create",
  authenticate,
  validateBody(createPaymentDto),
  paymentsController.create
);
router.post("/webhook", paymentsController.webhook);

export const paymentsRoutes = router;
