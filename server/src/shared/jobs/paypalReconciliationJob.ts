import { paymentsService } from "../../modules/payments/payments.service.js";
import { logger } from "../logger.js";
import { PAYPAL_RECONCILE_INTERVAL_MS } from "../config/paypal.js";

/**
 * In-process reconciliation for captured PayPal orders whose webhook was lost.
 * PostgreSQL remains authoritative; this timer only GETs PayPal order status
 * and reuses confirmPayment (idempotent). Overlapping replicas are safe.
 */
export function startPaypalReconciliationJob(): NodeJS.Timeout {
  const timer = setInterval(() => {
    paymentsService.reconcilePendingPaypalOrders().catch((err: unknown) => {
      logger.error({ err }, "paypal reconciliation sweep failed");
    });
  }, PAYPAL_RECONCILE_INTERVAL_MS);

  timer.unref();
  logger.info(
    { intervalMs: PAYPAL_RECONCILE_INTERVAL_MS },
    "paypal reconciliation sweep started"
  );
  return timer;
}
