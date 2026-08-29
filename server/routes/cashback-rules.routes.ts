import type { Router } from "express";
import {
  getAuditContext,
  getTenantId,
  insertCashbackRuleSchema,
  requireAuth,
  requireRole,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Cashback rule configuration.
 */
export function registerCashbackRuleRoutes(v1Router: Router): void {
  v1Router.get("/cashback-rules", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const rules = await storage.getCashbackRules(tenantId);
      res.json(rules);
    } catch {
      res.status(500).json({ error: "Failed to fetch cashback rules" });
    }
  });

  v1Router.post(
    "/cashback-rules",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertCashbackRuleSchema.parse({ ...req.body, tenantId });
        const rule = await storage.createCashbackRule(validatedData);
        res.status(201).json(rule);
      } catch {
        res.status(400).json({ error: "Invalid cashback rule data" });
      }
    },
  );

  v1Router.put(
    "/cashback-rules/:id",
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

        const updateSchema = insertCashbackRuleSchema.partial().omit({ tenantId: true });
        const validatedData = updateSchema.parse(req.body);

        if (Object.keys(validatedData).length === 0) {
          return res.status(400).json({ error: "Nenhum campo para atualizar" });
        }

        const updated = await storage.updateCashbackRule(tenantId, id, validatedData);
        if (!updated) {
          return res.status(404).json({ error: "Regra não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar regra de cashback" });
      }
    },
  );

  v1Router.delete(
    "/cashback-rules/:id",
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
        const deleted = await storage.deleteCashbackRule(tenantId, id, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "cashback_rules",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Regra não encontrada" });
        }
        res.json({ message: "Regra excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir regra de cashback" });
      }
    },
  );
}
