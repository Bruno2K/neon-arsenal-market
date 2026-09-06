import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "./AppError.js";
import { logger } from "../logger.js";
import { getLogBindings } from "../observability/context.js";
import { isRecord } from "../types/guards.js";

function isPayloadTooLarge(err: unknown): boolean {
  if (!isRecord(err)) return false;
  return err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413;
}

function isInvalidJson(err: unknown): boolean {
  if (isRecord(err) && err.type === "entity.parse.failed") return true;
  return err instanceof SyntaxError && isRecord(err) && err.status === 400;
}

function isCorsRejection(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("CORS:");
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const bindings = getLogBindings();
  const requestId = req.requestId ?? bindings.requestId;

  if (isPayloadTooLarge(err)) {
    res.status(413).json({ error: "Request payload too large." });
    return;
  }

  if (isInvalidJson(err)) {
    res.status(400).json({ error: "Invalid JSON body." });
    return;
  }

  if (isCorsRejection(err)) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, ...bindings, requestId }, err.message);
    }
    if (err.retryAfterSeconds != null) {
      res.setHeader("Retry-After", String(err.retryAfterSeconds));
    }
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Resource already exists with this unique field." });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Record not found." });
      return;
    }
  }

  logger.error({ err, ...bindings, requestId }, "Unhandled error");
  res.status(500).json({ error: "Internal server error." });
}
