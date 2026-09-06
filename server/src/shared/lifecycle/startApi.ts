import type { Express } from "express";
import type { Server } from "node:http";
import { logger } from "../logger.js";
import { startPaypalReconciliationJob } from "../jobs/paypalReconciliationJob.js";
import { startReservationExpiryJob } from "../jobs/reservationExpiryJob.js";
import { startOutboxDispatcherJob } from "../jobs/outboxDispatcherJob.js";
import { startSellerLedgerReconciliationJob } from "../jobs/sellerLedgerReconciliationJob.js";
import { installProcessShutdownHandlers } from "./shutdown.js";
import { assertProductionJwtSecrets } from "../utils/jwt.js";

export function startApiProcess(
  app: Express,
  options?: {
    port?: number;
    host?: string;
    installSignals?: boolean;
    onListening?: () => void | Promise<void>;
  }
): Server {
  assertProductionJwtSecrets();
  const port = options?.port ?? Number(process.env.PORT ?? 3001);
  const host = options?.host ?? "0.0.0.0";
  const jobs: NodeJS.Timeout[] = [];

  const server = app.listen(port, host, () => {
    logger.info({ host, port }, "http server listening");
    console.log(`Server running on http://${host}:${port}`);
    jobs.push(
      startReservationExpiryJob(),
      startPaypalReconciliationJob(),
      startSellerLedgerReconciliationJob(),
      startOutboxDispatcherJob()
    );
    void Promise.resolve(options?.onListening?.()).catch((err: unknown) => {
      logger.error({ err }, "onListening hook failed");
    });
  });

  const stopJobs = () => {
    for (const job of jobs) {
      clearInterval(job);
    }
    jobs.length = 0;
  };

  if (options?.installSignals !== false) {
    installProcessShutdownHandlers({ server, stopJobs });
  }

  return server;
}
