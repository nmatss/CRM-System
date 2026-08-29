import type { Router } from "express";
import { getTenantId, logger, requireAuth, sendError, storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Dashboard KPIs for the active tenant.
 */
export function registerDashboardRoutes(v1Router: Router): void {
  // ==================== DASHBOARD STATS ====================
  v1Router.get("/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const [stats, charts] = await Promise.all([
        storage.getDashboardStats(tenantId),
        storage.getDashboardCharts(tenantId),
      ]);
      const segmentColors: Record<string, string> = {
        VIP: "#9333ea",
        Regular: "#00C49F",
        Novo: "#FFBB28",
        "Em Risco": "#FF8042",
        Inativo: "#8884d8",
      };
      res.json({
        ...stats,
        salesChart: charts.revenueByMonth.map((month) => ({
          date: month.month,
          value: month.revenue,
          valueCents: month.revenueCents,
        })),
        customerSegments: charts.customersBySegment.map((segment) => ({
          name: segment.segment,
          value: segment.count,
          color: segmentColors[segment.segment] ?? "#8884d8",
        })),
        topProducts: charts.topProducts.map((product) => ({
          name: product.name,
          sales: product.quantity,
          revenue: product.revenue,
        })),
      });
    } catch (error) {
      logger.error("Dashboard stats query failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/dashboard/stats",
        userId: req.session.user?.id,
        tenantId: req.session.user?.tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });
}
