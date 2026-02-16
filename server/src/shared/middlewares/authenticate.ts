import { Request, Response, NextFunction } from "express";
import type { Role } from "../types/roles.js";
import { verifyAccessToken, type JwtPayload } from "../utils/jwt.js";
import { AppError } from "../errors/AppError.js";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next(new AppError(401, "Missing or invalid authorization header"));
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}
