import { listingsService } from "../../modules/listings/listings.service.js";
import { logger } from "../logger.js";
import { RESERVATION_EXPIRY_SWEEP_INTERVAL_MS } from "../config/reservation.js";

/**
 * In-process sweep for the modular monolith.
 * PostgreSQL remains the source of truth: this timer only invokes the
 * atomic expire update. Multiple app instances may run the same sweep;
 * overlapping executions are safe because the UPDATE is conditional.
 */
export function startReservationExpiryJob(): NodeJS.Timeout {
  const timer = setInterval(() => {
    listingsService.expireReservations().catch((err: unknown) => {
      logger.error({ err }, "reservation expiry sweep failed");
    });
  }, RESERVATION_EXPIRY_SWEEP_INTERVAL_MS);

  timer.unref();
  logger.info(
    { intervalMs: RESERVATION_EXPIRY_SWEEP_INTERVAL_MS },
    "reservation expiry sweep started"
  );
  return timer;
}
