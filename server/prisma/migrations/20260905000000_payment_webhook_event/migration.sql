-- Durable PayPal webhook identity for retry-safe, multi-instance processing.
CREATE TABLE "PaymentWebhookEvent" (
    "id"              TEXT         NOT NULL,
    "provider"        TEXT         NOT NULL DEFAULT 'PAYPAL',
    "externalEventId" TEXT         NOT NULL,
    "eventType"       TEXT         NOT NULL,
    "status"          TEXT         NOT NULL DEFAULT 'RECEIVED',
    "orderId"         TEXT,
    "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"     TIMESTAMP(3),
    "failureReason"   TEXT,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_externalEventId_key"
ON "PaymentWebhookEvent"("provider", "externalEventId");

CREATE INDEX "PaymentWebhookEvent_orderId_idx" ON "PaymentWebhookEvent"("orderId");
CREATE INDEX "PaymentWebhookEvent_status_idx" ON "PaymentWebhookEvent"("status");

-- Bind a reservation to the order that holds it so a stale capture cannot
-- sell a listing that later returned to ACTIVE and was reserved by another order.
ALTER TABLE "Listing" ADD COLUMN "reservedByOrderId" TEXT;
CREATE INDEX "Listing_reservedByOrderId_idx" ON "Listing"("reservedByOrderId");
