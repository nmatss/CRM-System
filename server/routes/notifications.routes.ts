import type { Router } from "express";
import {
  boundedLimitSchema,
  getTenantId,
  logger,
  requireAuth,
  scopeUserFilterToSession,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Notification rows for the active tenant.
 */
export function registerNotificationRoutes(v1Router: Router): void {
  // ==================== NOTIFICATIONS ROUTES ====================
  v1Router.get("/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const userId = scopeUserFilterToSession(req, req.query.userId as string | undefined);
      const parsedLimit = boundedLimitSchema.safeParse(req.query.limit ?? 50);
      if (!parsedLimit.success) {
        return sendError(res, 400, "Limite deve ser um inteiro entre 1 e 100", "INVALID_LIMIT");
      }
      const limit = parsedLimit.data;

      const notifications = await storage.getNotifications(tenantId, userId, limit);
      res.json(notifications);
    } catch (error) {
      logger.error("Notifications fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/notifications",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  });
}
