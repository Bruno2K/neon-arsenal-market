import { prisma } from "../database/index.js";
import {
  OUTBOX_CLAIM_BATCH_SIZE,
  OUTBOX_CLAIM_TIMEOUT_MS,
} from "../config/outbox.js";
import { sanitizeOutboxPayload } from "./outbox.sanitize.js";
import type { ClaimedOutboxEvent, OutboxClient, OutboxEnqueueInput } from "./outbox.types.js";

export const outboxRepository = {
  async enqueue(client: OutboxClient, input: OutboxEnqueueInput) {
    return client.outboxEvent.create({
      data: {
        type: input.type,
        aggregateId: input.aggregateId,
        payload: sanitizeOutboxPayload(input.payload),
        status: "PENDING",
      },
    });
  },

  /**
   * Claim due PENDING rows, or stale PROCESSING rows (crash after claim).
   * FOR UPDATE SKIP LOCKED so overlapping API replicas take disjoint sets.
   */
  async claimBatch(
    client: OutboxClient = prisma,
    now = new Date(),
    batchSize = OUTBOX_CLAIM_BATCH_SIZE
  ): Promise<ClaimedOutboxEvent[]> {
    const staleBefore = new Date(now.getTime() - OUTBOX_CLAIM_TIMEOUT_MS);
    const rows = await client.$queryRaw<ClaimedOutboxEvent[]>`
      WITH picked AS (
        SELECT e.id
        FROM "OutboxEvent" AS e
        WHERE e."availableAt" <= ${now}
          AND (
            e.status = 'PENDING'::"OutboxEventStatus"
            OR (
              e.status = 'PROCESSING'::"OutboxEventStatus"
              AND e."claimedAt" IS NOT NULL
              AND e."claimedAt" < ${staleBefore}
            )
          )
        ORDER BY e."createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "OutboxEvent" AS o
      SET
        status = 'PROCESSING'::"OutboxEventStatus",
        "claimedAt" = ${now},
        attempts = o.attempts + 1
      FROM picked
      WHERE o.id = picked.id
      RETURNING
        o.id,
        o.type,
        o."aggregateId",
        o.payload,
        o.status,
        o.attempts,
        o."availableAt",
        o."claimedAt",
        o."lastError",
        o."createdAt"
    `;
    return rows.map((row) => ({
      ...row,
      attempts: Number(row.attempts),
    }));
  },

  async markPublished(id: string, client: OutboxClient = prisma) {
    const updated = await client.outboxEvent.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "PUBLISHED", lastError: null },
    });
    return updated.count === 1;
  },

  async scheduleRetry(
    id: string,
    availableAt: Date,
    lastError: string,
    client: OutboxClient = prisma
  ) {
    const updated = await client.outboxEvent.updateMany({
      where: { id, status: "PROCESSING" },
      data: {
        status: "PENDING",
        availableAt,
        claimedAt: null,
        lastError,
      },
    });
    return updated.count === 1;
  },

  async markFailed(id: string, lastError: string, client: OutboxClient = prisma) {
    const updated = await client.outboxEvent.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "FAILED", lastError },
    });
    return updated.count === 1;
  },
};
