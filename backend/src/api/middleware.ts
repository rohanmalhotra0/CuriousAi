import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const DEMO_USER = "00000000-0000-0000-0000-000000000001";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/** Dev auth: trust an x-user-id header, else fall back to the seeded demo user. */
export function resolveUser(req: Request, _res: Response, next: NextFunction) {
  req.userId = (req.header("x-user-id") as string) || DEMO_USER;
  next();
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  logger.error("unhandled error", (err as Error)?.message);
  res.status(500).json({ error: "Internal server error" });
}
