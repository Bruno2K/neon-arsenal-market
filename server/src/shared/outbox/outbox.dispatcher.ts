import { logger } from "../logger.js";
import { prisma } from "../database/index.js";
import { appMetrics } from "../observability/metrics.js";
import { withSpan } from "../observability/tracing.js";
import { OUTBOX_MAX_ATTEMPTS, outboxBackoffDelayMs } from "../config/outbox.js";
import { outboxRepository } from "./outbox.repository.js";
import { sanitizeOutboxError } from "./outbox.sanitize.js";
import type { ClaimedOutboxEvent } from "./outbox.types.js";

export type OutboxHandleFn = (event: ClaimedOutboxEvent) => Promise<void>;

/**
 * First-slice handler: structured log only.
 * Does not call confirmPayment, does not write seller ledger, and does not
 * invent a second payment confirmation. Metrics fire on the PROCESSING →
 * PUBLISHED transition so a crash-retry of an already published row is a no-op.
 */
export async function handleOutboxEvent(event: ClaimedOutboxEvent): Promise<void> {
  logger.info(
    {
      outboxEventId: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
    },
    "outbox event published"
  );
}

export async function dispatchOutboxEvents(options?: {
  now?: Date;
  handle?: OutboxHandleFn;
}) {
  const now = options?.now ?? new Date();
  const handle = options?.handle ?? handleOutboxEvent;

  return withSpan("outbox.dispatch", {}, async (span) => {
    const claimed = await prisma.$transaction((tx) => outboxRepository.claimBatch(tx, now));
    let published = 0;
    let retried = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of claimed) {
      const outcome = await processClaimedEvent(event, now, handle);
      if (outcome === "published") published += 1;
      else if (outcome === "retried") retried += 1;
      else if (outcome === "failed") failed += 1;
      else skipped += 1;
    }

    span.setAttribute("app.outbox_claimed", claimed.length);
    span.setAttribute("app.outbox_published", published);
    span.setAttribute("app.outbox_retried", retried);
    span.setAttribute("app.outbox_failed", failed);
    return { claimed: claimed.length, published, retried, failed, skipped };
  });
}

async function processClaimedEvent(
  event: ClaimedOutboxEvent,
  now: Date,
  handle: OutboxHandleFn
): Promise<"published" | "retried" | "failed" | "skipped"> {
  if (event.status === "PUBLISHED") {
    return "skipped";
  }

  try {
    await handle(event);
    const moved = await outboxRepository.markPublished(event.id);
    if (!moved) {
      logger.info(
        { outboxEventId: event.id, type: event.type },
        "outbox event already published"
      );
      return "skipped";
    }
    appMetrics.outboxPublished();
    return "published";
  } catch (err) {
    const lastError = sanitizeOutboxError(err);
    if (event.attempts >= OUTBOX_MAX_ATTEMPTS) {
      await outboxRepository.markFailed(event.id, lastError);
      appMetrics.outboxFailed();
      logger.error(
        { err, outboxEventId: event.id, type: event.type, attempts: event.attempts },
        "outbox event failed"
      );
      return "failed";
    }

    const delayMs = outboxBackoffDelayMs(event.attempts);
    await outboxRepository.scheduleRetry(event.id, new Date(now.getTime() + delayMs), lastError);
    appMetrics.outboxRetry();
    logger.warn(
      {
        err,
        outboxEventId: event.id,
        type: event.type,
        attempts: event.attempts,
        delayMs,
      },
      "outbox event retry scheduled"
    );
    return "retried";
  }
}
