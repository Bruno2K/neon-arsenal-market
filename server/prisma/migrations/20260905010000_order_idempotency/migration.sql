-- Durable order-creation idempotency scoped to the authenticated user.
CREATE TABLE "OrderIdempotency" (
    "id"          TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "key"         VARCHAR(128) NOT NULL,
    "fingerprint" TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'PROCESSING',
    "orderId"     TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OrderIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderIdempotency_userId_key_key" ON "OrderIdempotency"("userId", "key");
CREATE UNIQUE INDEX "OrderIdempotency_orderId_key" ON "OrderIdempotency"("orderId");
CREATE INDEX "OrderIdempotency_createdAt_idx" ON "OrderIdempotency"("createdAt");

ALTER TABLE "OrderIdempotency"
    ADD CONSTRAINT "OrderIdempotency_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderIdempotency"
    ADD CONSTRAINT "OrderIdempotency_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
