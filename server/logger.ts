import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { buildId } from "./buildInfo";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogContext {
  userId?: string;
  tenantId?: number;
  endpoint?: string;
  requestId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN = /(password|token|secret|session|authorization|cookie|csrf)/i;

function shouldLogStack(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.LOG_STACKS === "true";
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[REDACTED_DEPTH]";
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: shouldLogStack() ? value.stack : "[REDACTED]",
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) || (key === "stack" && !shouldLogStack())
        ? "[REDACTED]"
        : sanitizeForLog(nestedValue, depth + 1),
    ]),
  );
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const safeContext = sanitizeForLog(context) as LogContext | undefined;

    const logObject = {
      timestamp,
      level: level.toUpperCase(),
      // Correlates a line with the exact artifact that emitted it.
      build: buildId,
      requestId: safeContext?.requestId || "no-request-id",
      message,
      ...safeContext,
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

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
  }
}

// Middleware to add request ID to all requests
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const suppliedRequestId = req.headers["x-request-id"];
  const requestId =
    typeof suppliedRequestId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
