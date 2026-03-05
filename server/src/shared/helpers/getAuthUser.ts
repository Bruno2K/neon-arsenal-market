import { Request } from "express";
import { AppError } from "../errors/AppError.js";
import type { AuthUser } from "../middlewares/authenticate.js";

/**
 * Returns the authenticated user from the request. Use only on routes
 * protected by the authenticate middleware. Throws 401 if user is missing.
 */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }
  return req.user;
}
