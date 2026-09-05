import { Router, Request, Response } from "express";
import { prisma } from "../database/index.js";
import { isProcessShuttingDown } from "../lifecycle/state.js";
import { logger } from "../logger.js";

const router = Router();

/**
 * Liveness: the process is up. Used by Docker HEALTHCHECK.
 * Stays 200 during SIGTERM drain so a liveness probe does not kill a draining instance.
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

/**
 * Readiness: this instance may receive traffic.
 * Used by Render `healthCheckPath`. 503 while shutting down or if PostgreSQL is unreachable.
 */
router.get("/ready", async (_req: Request, res: Response) => {
  if (isProcessShuttingDown()) {
    res.status(503).json({ status: "shutting_down" });
    return;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (err) {
    logger.error({ err }, "Readiness check failed");
    res.status(503).json({ status: "unavailable" });
  }
});

export const healthRoutes = router;
