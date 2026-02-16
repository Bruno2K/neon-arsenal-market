import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, "Route not found"));
}
