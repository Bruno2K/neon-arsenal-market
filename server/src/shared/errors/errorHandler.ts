import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "./AppError.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
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

  console.error(err);
  res.status(500).json({ error: "Internal server error." });
}
