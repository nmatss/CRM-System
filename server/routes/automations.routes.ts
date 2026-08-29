import type { Router } from "express";
import {
  createAutomationSchema,
  getAuditContext,
  getTenantId,
  requireAuth,
  requireRole,
  sendError,
  storage,
  updateAutomationSchema,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Automation definitions with a versioned trigger and action.
 */
export function registerAutomationRoutes(v1Router: Router): void {
  v1Router.get("/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const automations = await storage.getAutomations(tenantId);
      res.json(automations);
    } catch {
      res.status(500).json({ error: "Failed to fetch automations" });
    }
  });

  v1Router.post(
    "/automations",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = createAutomationSchema.parse({ ...req.body, tenantId });
        const automation = await storage.createAutomation(validatedData);
        res.status(201).json(automation);
      } catch {
        res.status(400).json({ error: "Invalid automation data" });
      }
    },
  );

  v1Router.put(
    "/automations/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const updateData = updateAutomationSchema.parse(req.body);
        const updated = await storage.updateAutomation(tenantId, id, updateData);
        if (!updated) {
          return res.status(404).json({ error: "Automação não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar automação" });
      }
    },
  );

  v1Router.delete(
    "/automations/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteAutomation(tenantId, id, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "automations",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Automação não encontrada" });
        }
        res.json({ message: "Automação excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir automação" });
      }
    },
  );

  v1Router.patch(
    "/automations/:id/toggle",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const automation = await storage.getAutomation(tenantId, id);
        if (!automation) {
          return res.status(404).json({ error: "Automação não encontrada" });
        }
        const updated = await storage.updateAutomation(tenantId, id, {
          isActive: !automation.isActive,
        });
        res.json(updated);
      } catch {
        res.status(500).json({ error: "Erro ao alternar automação" });
      }
    },
  );
}
