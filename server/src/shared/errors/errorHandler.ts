import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "./AppError.js";
import { logger } from "../logger.js";
import { getLogBindings } from "../observability/context.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const bindings = getLogBindings();
  const requestId = req.requestId ?? bindings.requestId;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, ...bindings, requestId }, err.message);
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
