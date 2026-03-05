import { Router, Request, Response } from "express";
import { prisma } from "../database/index.js";
import { logger } from "../logger.js";

const router = Router();

/** Liveness: process is up */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

/** Readiness: app can serve traffic (e.g. DB reachable) */
router.get("/ready", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (err) {
    logger.error({ err }, "Readiness check failed");
    res.status(503).json({ status: "unavailable" });
  }
});

export const healthRoutes = router;
