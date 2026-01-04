import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogContext {
  userId?: string;
  tenantId?: number;
  endpoint?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();

    const logObject = {
      timestamp,
      level: level.toUpperCase(),
      requestId: context?.requestId || "no-request-id",
      message,
      ...context,
    };

    return JSON.stringify(logObject);
  }

  error(message: string, context?: LogContext) {
    console.error(this.formatMessage("error", message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage("warn", message, context));
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage("info", message, context));
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("debug", message, context));
    }
  }
}

export const logger = new Logger();

// Middleware to add request ID to all requests
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
