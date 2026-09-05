import { dispatchOutboxEvents } from "../outbox/outbox.dispatcher.js";
import { logger } from "../logger.js";
import { OUTBOX_DISPATCH_INTERVAL_MS } from "../config/outbox.js";

/**
 * In-process transactional-outbox dispatcher for the modular monolith.
 * PostgreSQL remains the source of truth: this timer claims PENDING rows with
 * FOR UPDATE SKIP LOCKED. Overlapping replicas are safe. Not SQS (#53).
 */
export function startOutboxDispatcherJob(): NodeJS.Timeout {
  const timer = setInterval(() => {
    dispatchOutboxEvents().catch((err: unknown) => {
      logger.error({ err }, "outbox dispatcher sweep failed");
    });
  }, OUTBOX_DISPATCH_INTERVAL_MS);

  timer.unref();
  logger.info({ intervalMs: OUTBOX_DISPATCH_INTERVAL_MS }, "outbox dispatcher started");
  return timer;
}
