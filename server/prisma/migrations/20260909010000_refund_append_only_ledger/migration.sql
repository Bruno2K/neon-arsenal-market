-- TASK-0013 / ADR 0023: durable full-refund obligations and append-only
-- seller compensation. Existing ledger values are not rewritten.

CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "RefundReason" AS ENUM ('UNFULFILLABLE_CAPTURE');
CREATE TYPE "SellerLedgerEntryType" AS ENUM ('PAYMENT_CREDIT', 'REFUND_COMPENSATION');

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPAL',
  "providerCaptureId" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "amount" DECIMAL(65,30) NOT NULL,
  "reason" "RefundReason" NOT NULL DEFAULT 'UNFULFILLABLE_CAPTURE',
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "failureReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_amount_full_brl_chk" CHECK ("amount" > 0 AND "amount" = ROUND("amount", 2)),
  CONSTRAINT "Refund_provider_capture_nonempty_chk" CHECK (LENGTH(BTRIM("providerCaptureId")) > 0),
  CONSTRAINT "Refund_provider_refund_nonempty_chk" CHECK ("providerRefundId" IS NULL OR LENGTH(BTRIM("providerRefundId")) > 0)
);

CREATE UNIQUE INDEX "Refund_provider_providerCaptureId_key" ON "Refund"("provider", "providerCaptureId");
CREATE UNIQUE INDEX "Refund_provider_providerRefundId_key" ON "Refund"("provider", "providerRefundId");
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");
CREATE INDEX "Refund_status_updatedAt_idx" ON "Refund"("status", "updatedAt");

ALTER TABLE "SellerTransaction"
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "entryType" "SellerLedgerEntryType" NOT NULL DEFAULT 'PAYMENT_CREDIT',
  ADD COLUMN "economicEventId" TEXT;

-- Backfill identity only. The historical gross, commission, net, status,
-- timestamps, and seller projection remain byte-for-byte/economically unchanged.
UPDATE "SellerTransaction"
SET "economicEventId" = "orderId";

DROP INDEX "SellerTransaction_sellerId_orderId_key";

ALTER TABLE "SellerTransaction"
  ALTER COLUMN "economicEventId" SET NOT NULL,
  DROP CONSTRAINT "SellerTransaction_amounts_non_negative_chk",
  ADD CONSTRAINT "SellerTransaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SellerTransaction_entry_shape_chk" CHECK (
    ("entryType" = 'PAYMENT_CREDIT' AND "refundId" IS NULL AND "economicEventId" = "orderId"
      AND "grossAmount" >= 0 AND "commissionAmount" >= 0 AND "netAmount" >= 0)
    OR
    ("entryType" = 'REFUND_COMPENSATION' AND "refundId" IS NOT NULL AND "economicEventId" = "refundId"
      AND "grossAmount" <= 0 AND "commissionAmount" <= 0 AND "netAmount" <= 0)
  );

CREATE UNIQUE INDEX "SellerTransaction_sellerId_entryType_economicEventId_key"
  ON "SellerTransaction"("sellerId", "entryType", "economicEventId");
CREATE INDEX "SellerTransaction_refundId_idx" ON "SellerTransaction"("refundId");
CREATE INDEX "SellerTransaction_sellerId_status_idx" ON "SellerTransaction"("sellerId", "status");
