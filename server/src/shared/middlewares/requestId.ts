import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

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

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = (req.headers["x-request-id"] as string) || randomUUID();
  next();
}
