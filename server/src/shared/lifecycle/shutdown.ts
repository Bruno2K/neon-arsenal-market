import type { Server } from "node:http";
import { logger } from "../logger.js";
import { disconnectPrisma } from "../database/prisma.js";
import { shutdownTelemetry } from "../observability/sdk.js";
import { beginShutdown, isProcessShuttingDown } from "./state.js";

/** Bound wait for in-flight HTTP requests before connections are forced closed. */
export const SHUTDOWN_DRAIN_MS = 10_000;

export type GracefulShutdownParams = {
  server: Server;
  stopJobs: () => void;
  disconnectDb?: () => Promise<void>;
  shutdownTelemetryFn?: () => Promise<void>;
  drainMs?: number;
  exit?: (code: number) => void;
};

let inFlight: Promise<void> | undefined;

export async function runGracefulShutdown(params: GracefulShutdownParams): Promise<void> {
  if (!inFlight) {
    inFlight = performShutdown(params);
  }
  await inFlight;
}

export function resetShutdownForTests(): void {
  inFlight = undefined;
}

export function installProcessShutdownHandlers(
  params: GracefulShutdownParams,
  signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"]
): () => Promise<void> {
  const shutdown = () =>
    runGracefulShutdown({
      ...params,
      exit: params.exit ?? ((code) => process.exit(code)),
    });

  for (const signal of signals) {
    process.once(signal, () => {
      logger.info({ signal }, "shutdown signal received");
      void shutdown();
    });
  }

  return shutdown;
}

async function performShutdown(params: GracefulShutdownParams): Promise<void> {
  const drainMs = params.drainMs ?? SHUTDOWN_DRAIN_MS;
  const disconnectDb = params.disconnectDb ?? disconnectPrisma;
  const shutdownTelemetryFn = params.shutdownTelemetryFn ?? shutdownTelemetry;
  let exitCode = 0;

  beginShutdown();
  logger.info("graceful shutdown started");
  params.stopJobs();

  try {
    await closeHttpServer(params.server, drainMs);
  } catch (err) {
    exitCode = 1;
    logger.error({ err }, "http server close failed");
  }

  try {
    await disconnectDb();
  } catch (err) {
    exitCode = 1;
    logger.error({ err }, "database disconnect failed");
  }

  try {
    await shutdownTelemetryFn();
  } catch (err) {
    exitCode = 1;
    logger.error({ err }, "telemetry shutdown failed");
  }

  logger.info({ exitCode, shuttingDown: isProcessShuttingDown() }, "graceful shutdown finished");
  params.exit?.(exitCode);
}

async function closeHttpServer(server: Server, drainMs: number): Promise<void> {
  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }

  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      forceTimer = setTimeout(() => {
        if (typeof server.closeAllConnections === "function") {
          server.closeAllConnections();
        }
      }, drainMs);
      forceTimer.unref();
    });
  } finally {
    if (forceTimer) clearTimeout(forceTimer);
  }
}
