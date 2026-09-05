-- Keyset pagination for GET /listings and GET /products.
-- ORDER BY "createdAt" DESC, id DESC (id is the tie-breaker).
-- (status, createdAt, id) replaces (status, createdAt): left-prefix still serves
-- status-only filters; the extra id column covers the market keyset.

CREATE INDEX "Listing_createdAt_id_idx" ON "Listing"("createdAt", "id");

DROP INDEX IF EXISTS "Listing_status_createdAt_idx";
CREATE INDEX "Listing_status_createdAt_id_idx" ON "Listing"("status", "createdAt", "id");

CREATE INDEX "Product_createdAt_id_idx" ON "Product"("createdAt", "id");
