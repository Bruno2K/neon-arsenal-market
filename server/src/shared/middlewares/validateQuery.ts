import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { replaceRequestField } from "../http/requestFields.js";

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      replaceRequestField(req, "query", schema.parse(req.query) as object);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        next(new AppError(400, message));
        return;
      }
      next(err);
    }
  };
}
