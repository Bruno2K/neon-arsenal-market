/**
 * How often the in-process sweep compares Seller.balance to PAID ledger SUM.
 * Constant, matching PAYPAL_RECONCILE_INTERVAL_MS — not an env var.
 */
export const SELLER_LEDGER_RECONCILE_INTERVAL_MS = 60_000;
