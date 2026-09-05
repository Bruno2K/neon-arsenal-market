-- Transactional outbox (docs/adr/0012-transactional-outbox.md).
-- Events commit in the same local transaction as the domain mutation.
-- PayPal HTTP stays outside that transaction. No secrets in payload.

CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxEvent_type_aggregateId_key" ON "OutboxEvent"("type", "aggregateId");
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_aggregateId_idx" ON "OutboxEvent"("aggregateId");
