-- Market browse: WHERE status = 'ACTIVE' ORDER BY "createdAt" DESC LIMIT n
-- The single-column status index is redundant with this left-prefix.
DROP INDEX IF EXISTS "Listing_status_idx";
CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");

-- PayPal reconciliation: pending paid-but-unconfirmed orders ordered by age.
-- Replaces the standalone paymentStatus index (left-prefix of this composite).
DROP INDEX IF EXISTS "Order_paymentStatus_idx";
CREATE INDEX "Order_paymentStatus_status_updatedAt_idx"
ON "Order"("paymentStatus", "status", "updatedAt");
