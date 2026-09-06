import { Router } from "express";
import { paymentsController } from "./payments.controller.js";
import { authenticate } from "../../shared/middlewares/authenticate.js";
import { validateBody } from "../../shared/middlewares/validateBody.js";
import { capturePaymentDto, createPaymentDto } from "./payments.dto.js";

const router = Router();

router.post(
  "/create",
  authenticate,
  validateBody(createPaymentDto),
  paymentsController.create
);
router.post(
  "/capture",
  authenticate,
  validateBody(capturePaymentDto),
  paymentsController.capture
);
// INV-PAYMENT-TRUSTED-CONFIRM: no client confirm route. PAID is PayPal COMPLETED
// (OrdersCapture / OrdersGet / PAYMENT.CAPTURE.COMPLETED), never a client flag.
router.post("/webhook", paymentsController.webhook);

export const paymentsRoutes = router;
