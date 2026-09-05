import { commissionsService } from "../../modules/commissions/commissions.service.js";
import { logger } from "../logger.js";
import { SELLER_LEDGER_RECONCILE_INTERVAL_MS } from "../config/sellerLedger.js";

/**
 * In-process seller ledger reconciliation for the modular monolith.
 * PostgreSQL remains the source of truth: SellerTransaction (PAID SUM) wins
 * over Seller.balance. Overlapping replicas are safe because each correction
 * locks the seller row, re-reads, and no-ops when already aligned.
 */
export function startSellerLedgerReconciliationJob(): NodeJS.Timeout {
  const timer = setInterval(() => {
    commissionsService.reconcileSellerLedger().catch((err: unknown) => {
      logger.error({ err }, "seller ledger reconciliation sweep failed");
    });
  }, SELLER_LEDGER_RECONCILE_INTERVAL_MS);

  timer.unref();
  logger.info(
    { intervalMs: SELLER_LEDGER_RECONCILE_INTERVAL_MS },
    "seller ledger reconciliation sweep started"
  );
  return timer;
}
