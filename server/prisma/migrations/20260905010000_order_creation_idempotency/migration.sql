-- Durable order-creation idempotency for retry-safe customer checkout.
CREATE TABLE "OrderIdempotencyKey" (
    "id"          TEXT         NOT NULL,
    "customerId"  TEXT         NOT NULL,
    "key"         TEXT         NOT NULL,
    "requestHash" TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'IN_PROGRESS',
    "orderId"     TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderIdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderIdempotencyKey_customerId_key_key"
ON "OrderIdempotencyKey"("customerId", "key");

CREATE UNIQUE INDEX "OrderIdempotencyKey_orderId_key"
ON "OrderIdempotencyKey"("orderId");

CREATE INDEX "OrderIdempotencyKey_customerId_idx"
ON "OrderIdempotencyKey"("customerId");

ALTER TABLE "OrderIdempotencyKey"
    ADD CONSTRAINT "OrderIdempotencyKey_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderIdempotencyKey"
    ADD CONSTRAINT "OrderIdempotencyKey_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
