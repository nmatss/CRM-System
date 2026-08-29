import type { Router } from "express";
import {
  buildInfo,
  configuredChannels,
  getOutboxBacklog,
  renderMetrics,
  requireSuperAdmin,
  storage,
} from "./shared";
import type { Express, Request, Response } from "./shared";

/**
 * Health, readiness, metrics and operator diagnostics.
 */
export function registerSystemRoutes(v1Router: Router, app: Express): void {
  // ==================== HEALTH CHECK ====================
  // Keep health check at root for backward compatibility
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: buildInfo.version,
      // Ties an incident to the exact artifact serving it.
      commit: buildInfo.commit,
      builtAt: buildInfo.builtAt,
    });
  });

  app.get("/api/ready", async (_req: Request, res: Response) => {
    const ready = await storage.healthCheck();
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      database: ready ? "connected" : "disconnected",
    });
  });

  v1Router.get("/admin/metrics", requireSuperAdmin, async (_req: Request, res: Response) => {
    // Prometheus exposition format. Restricted to super admins because it
    // reveals traffic shape and backlog of the whole installation.
    const databaseConnected = await storage.healthCheck().catch(() => false);
    res.type("text/plain; version=0.0.4; charset=utf-8").send(
      renderMetrics({
        outboxBacklog: getOutboxBacklog(),
        databaseConnected,
      }),
    );
  });

  v1Router.get("/admin/diagnostics/outbox", requireSuperAdmin, (_req, res) => {
    // Backlog snapshot used by the production runbook.
    res.json({ backlog: getOutboxBacklog(), configuredChannels: configuredChannels() });
  });

  v1Router.get("/admin/diagnostics/database", requireSuperAdmin, async (_req, res) => {
    const valid = await storage.deepHealthCheck();
    res.status(valid ? 200 : 503).json({ status: valid ? "ok" : "failed" });
  });
}
