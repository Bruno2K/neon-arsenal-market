-- Persist checkout reservation window used by the ACTIVE → RESERVED lifecycle.
ALTER TABLE "Listing" ADD COLUMN "reservedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

CREATE INDEX "Listing_status_reservationExpiresAt_idx"
ON "Listing"("status", "reservationExpiresAt");
