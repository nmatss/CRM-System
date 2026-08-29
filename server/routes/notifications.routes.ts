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
        requestId: req.requestId,
        endpoint: "/api/v1/notifications",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  });

  /**
   * Marks one notification read. Scoped to the tenant and to the signed-in user,
   * so an id from another account changes nothing.
   */
  v1Router.patch("/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.session.user?.id;
      if (!tenantId || !userId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return sendError(res, 400, "ID inválido", "INVALID_ID");
      }

      const updated = await storage.markNotificationRead(tenantId, userId, id);
      if (!updated) {
        return sendError(res, 404, "Notificação não encontrada", "NOTIFICATION_NOT_FOUND");
      }
      res.json(updated);
    } catch (error) {
      logger.error("Notification read failed", {
        requestId: req.requestId,
        endpoint: "/api/v1/notifications/:id/read",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao marcar notificação como lida" });
    }
  });

  /** Clears the badge in one action, for the signed-in user only. */
  v1Router.post("/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.session.user?.id;
      if (!tenantId || !userId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const updated = await storage.markAllNotificationsRead(tenantId, userId);
      res.json({ updated });
    } catch (error) {
      logger.error("Notification read-all failed", {
        requestId: req.requestId,
        endpoint: "/api/v1/notifications/read-all",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao marcar notificações como lidas" });
    }
  });
}
