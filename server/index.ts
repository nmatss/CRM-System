import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { generalLimiter } from "./rateLimit";
import { logger, requestIdMiddleware } from "./logger";
import { sqlite } from "./db";
import { sessionSqlite, usingSeparateSessionDatabase } from "./sessionDb";

const app = express();
const httpServer = createServer(app);

const trustProxy = process.env.TRUST_PROXY?.trim();
if (trustProxy) {
  if (/^\d+$/.test(trustProxy)) {
    app.set("trust proxy", Number(trustProxy));
  } else {
    app.set(
      "trust proxy",
      trustProxy
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
  }
}

if (process.env.NODE_ENV === "production") {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "data:"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      },
      frameguard: {
        action: "deny",
      },
    }),
  );
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Correlate every API response, including requests rejected by rate limiting.
app.use(requestIdMiddleware);

// Apply general rate limiting to all API routes
app.use("/api/", generalLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info("HTTP request completed", {
        requestId: req.requestId,
        endpoint: path,
        method: req.method,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    }
  });

  next();
});

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  details?: unknown;
}

let shutdownStarted = false;

function closeDatabases() {
  if (usingSeparateSessionDatabase && sessionSqlite.open) {
    sessionSqlite.close();
  }
  if (sqlite.open) {
    sqlite.close();
  }
}

function shutdown(signal: string, exitCode = 0) {
  if (shutdownStarted) return;
  shutdownStarted = true;

  logger.info("Application shutdown started", { signal });
  const forceTimer = setTimeout(() => {
    logger.error("Application shutdown timed out", { signal });
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  const finish = (error?: Error) => {
    clearTimeout(forceTimer);
    try {
      closeDatabases();
    } catch (closeError) {
      logger.error("Failed to close SQLite connections", {
        signal,
        error: closeError,
      });
      exitCode = 1;
    }

    if (error) {
      logger.error("HTTP server shutdown failed", { signal, error });
      exitCode = 1;
    } else {
      logger.info("Application shutdown completed", { signal });
    }
    process.exit(exitCode);
  };

  if (!httpServer.listening) {
    finish();
    return;
  }

  httpServer.close(finish);
  httpServer.closeIdleConnections();
}

async function startApplication() {
  await registerRoutes(httpServer, app);

  app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
    const requestedStatus = err.status || err.statusCode || 500;
    const status = requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
    const exposeDetails = process.env.NODE_ENV === "development";
    const message =
      status >= 500 && !exposeDetails ? "Internal Server Error" : err.message || "Request failed";

    // Standardized error response format
    const errorResponse: { error: string; code?: string; details?: unknown } = {
      error: message,
    };

    // Add error code if available
    if (err.code) {
      errorResponse.code = err.code;
    }

    // Add additional details in development mode
    if (exposeDetails && err.stack) {
      errorResponse.details = {
        stack: err.stack,
        ...(typeof err.details === "object" && err.details ? err.details : {}),
      };
    }

    logger.error("Unhandled request error", {
      requestId: req.requestId,
      endpoint: req.path,
      method: req.method,
      statusCode: status,
      error: err,
    });
    res.status(status).json(errorResponse);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      logger.info("Application started", { port });
    },
  );
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  shutdown("uncaughtException", 1);
});
process.once("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  shutdown("unhandledRejection", 1);
});

void startApplication().catch((error: unknown) => {
  logger.error("Application startup failed", { error });
  shutdown("startupFailure", 1);
});
