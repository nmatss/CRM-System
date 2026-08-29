import type { Router } from "express";
import {
  ZodError,
  getTenantId,
  handleZodError,
  logger,
  reportQuerySchema,
  requireAuth,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Sales report with an explicit UTC contract.
 */
export function registerReportRoutes(v1Router: Router): void {
  // ==================== REPORTS ROUTES ====================
  v1Router.get("/reports", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const query = reportQuerySchema.parse(req.query);
      res.json(await storage.getSalesReport(tenantId, query));
    } catch (error) {
      if (error instanceof ZodError) {
        const parsed = handleZodError(error);
        return sendError(res, 400, parsed.message, "INVALID_REPORT_QUERY", parsed.details);
      }
      logger.error("Reports generation failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/reports",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: "Erro ao gerar relatórios" });
    }
  });
}
