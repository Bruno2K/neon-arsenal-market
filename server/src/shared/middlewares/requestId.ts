import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { runWithRequestId } from "../observability/context.js";

declare global {
  // Express module augmentation (Request.requestId / rawBody)
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      rawBody?: Buffer;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  runWithRequestId(req.requestId, () => next());
}
