import type { Router } from "express";
import { getTenantId, logger, requireAuth, sendError, storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Time series consumed by the dashboard.
 */
export function registerDashboardChartRoutes(v1Router: Router): void {
  // ==================== DASHBOARD ROUTES ====================
  v1Router.get("/dashboard/charts", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const charts = await storage.getDashboardCharts(tenantId);
      res.json(charts);
    } catch (error) {
      logger.error("Dashboard charts fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/dashboard/charts",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar gráficos do dashboard" });
    }
  });
}
