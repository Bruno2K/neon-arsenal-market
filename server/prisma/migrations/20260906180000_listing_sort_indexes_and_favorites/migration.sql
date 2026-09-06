-- GET /listings?sort=price_* / float_* (issue #93 / ADR 0006).
-- Left-prefix still serves status-only filters; id is the sort tie-breaker.

CREATE INDEX "Listing_status_price_id_idx" ON "Listing"("status", "price", "id");
CREATE INDEX "Listing_status_floatValue_id_idx" ON "Listing"("status", "floatValue", "id");

-- Customer favorites (issue #106 / SPEC-0004). Unique (userId, listingId).
-- Cascade on user/listing hard-delete; listing lifecycle (SOLD/CANCELED)
-- never removes the relation. Writes do not touch reservation or payment.

CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Favorite_userId_listingId_key" ON "Favorite"("userId", "listingId");
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");
CREATE INDEX "Favorite_listingId_idx" ON "Favorite"("listingId");

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
