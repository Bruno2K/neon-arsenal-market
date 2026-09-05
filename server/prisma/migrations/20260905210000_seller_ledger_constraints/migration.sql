-- SellerTransaction is the authoritative seller ledger (docs/adr/0011-seller-ledger.md).
-- net = gross − commission must hold at PostgreSQL, not only in application code.
-- Amounts are non-negative. Duplicate (sellerId, orderId) remains unique from
-- 20260903000000_unique_seller_transaction_per_order.

ALTER TABLE "SellerTransaction"
  ADD CONSTRAINT "SellerTransaction_net_identity_chk"
  CHECK ("netAmount" = "grossAmount" - "commissionAmount");

ALTER TABLE "SellerTransaction"
  ADD CONSTRAINT "SellerTransaction_amounts_non_negative_chk"
  CHECK ("grossAmount" >= 0 AND "commissionAmount" >= 0 AND "netAmount" >= 0);
