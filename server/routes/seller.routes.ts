import type { Router } from "express";
import {
  boundedLimitSchema,
  getAuditContext,
  getTenantId,
  insertSellerTaskSchema,
  isActiveUserInTenant,
  isCustomerInTenant,
  isSellerSession,
  requireAuth,
  requireRole,
  scopeUserFilterToSession,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Seller agenda: tasks, goals, interactions and ranking.
 */
export function registerSellerRoutes(v1Router: Router): void {
  // ==================== SELLER TASKS ====================
  v1Router.get("/seller-tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const filters = {
        sellerId: scopeUserFilterToSession(req, req.query.sellerId as string | undefined),
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        type: req.query.type as string | undefined,
      };

      const tasks = await storage.getSellerTasks(tenantId, filters);
      res.json(tasks);
    } catch {
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  });

  v1Router.get("/seller-tasks/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const sellerId = scopeUserFilterToSession(req, req.query.sellerId as string | undefined);
      const stats = await storage.getSellerStats(tenantId, sellerId);
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  v1Router.post(
    "/seller-tasks",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertSellerTaskSchema.parse({
          ...req.body,
          tenantId,
          sellerId: isSellerSession(req) ? req.session.user!.id : req.body.sellerId,
        });
        if (
          validatedData.customerId &&
          !(await isCustomerInTenant(tenantId, validatedData.customerId))
        ) {
          return sendError(
            res,
            400,
            "Cliente inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }
        if (
          validatedData.sellerId &&
          !(await isActiveUserInTenant(tenantId, validatedData.sellerId))
        ) {
          return sendError(
            res,
            400,
            "Vendedor inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }
        const task = await storage.createSellerTask(validatedData);
        res.status(201).json(task);
      } catch {
        res.status(400).json({ error: "Dados da tarefa inválidos" });
      }
    },
  );

  v1Router.put(
    "/seller-tasks/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const taskId = parseInt(req.params.id);
        if (isNaN(taskId)) {
          return sendError(res, 400, "ID de tarefa inválido", "INVALID_ID");
        }
        const { status, notes } = req.body;

        if (isSellerSession(req)) {
          const task = await storage.getSellerTask(tenantId, taskId);
          if (!task || task.sellerId !== req.session.user!.id) {
            return res.status(403).json({ error: "Acesso negado a esta tarefa" });
          }
        }

        const updateData: Record<string, any> = {};
        if (status !== undefined) {
          updateData.status = status;
          if (status === "completed") {
            updateData.completedAt = new Date().toISOString();
          }
        }
        if (notes !== undefined) updateData.notes = notes;

        const updated = await storage.updateSellerTask(tenantId, taskId, updateData);
        if (!updated) {
          return res.status(404).json({ error: "Tarefa não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar tarefa" });
      }
    },
  );

  v1Router.delete(
    "/seller-tasks/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const taskId = parseInt(req.params.id);
        if (isNaN(taskId)) {
          return sendError(res, 400, "ID de tarefa inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteSellerTask(tenantId, taskId, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "seller_tasks",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Tarefa não encontrada" });
        }
        res.json({ message: "Tarefa excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir tarefa" });
      }
    },
  );

  // ==================== SELLER GOALS ROUTES ====================
  v1Router.get("/seller-goals", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const sellerId = scopeUserFilterToSession(req, req.query.sellerId as string | undefined);
      const goals = await storage.getSellerGoals(tenantId, sellerId);
      res.json(
        goals || {
          dailyTaskGoal: 10,
          weeklyTaskGoal: 50,
          monthlyTaskGoal: 200,
          dailySalesGoal: "0",
          weeklySalesGoal: "0",
          monthlySalesGoal: "0",
        },
      );
    } catch {
      res.status(500).json({ error: "Erro ao buscar metas" });
    }
  });

  v1Router.post(
    "/seller-goals",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const {
          dailyTaskGoal,
          weeklyTaskGoal,
          monthlyTaskGoal,
          dailySalesGoal,
          weeklySalesGoal,
          monthlySalesGoal,
          sellerId,
        } = req.body;

        if (
          dailyTaskGoal !== undefined &&
          (typeof dailyTaskGoal !== "number" || dailyTaskGoal < 1)
        ) {
          return res.status(400).json({ error: "Meta diária deve ser um número maior que 0" });
        }
        if (
          weeklyTaskGoal !== undefined &&
          (typeof weeklyTaskGoal !== "number" || weeklyTaskGoal < 1)
        ) {
          return res.status(400).json({ error: "Meta semanal deve ser um número maior que 0" });
        }
        if (
          monthlyTaskGoal !== undefined &&
          (typeof monthlyTaskGoal !== "number" || monthlyTaskGoal < 1)
        ) {
          return res.status(400).json({ error: "Meta mensal deve ser um número maior que 0" });
        }
        if (sellerId && !(await isActiveUserInTenant(tenantId, sellerId))) {
          return sendError(
            res,
            400,
            "Vendedor inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }

        const goalsData = {
          tenantId,
          sellerId: sellerId || null,
          dailyTaskGoal: dailyTaskGoal || 10,
          weeklyTaskGoal: weeklyTaskGoal || 50,
          monthlyTaskGoal: monthlyTaskGoal || 200,
          dailySalesGoal: dailySalesGoal || "0",
          weeklySalesGoal: weeklySalesGoal || "0",
          monthlySalesGoal: monthlySalesGoal || "0",
        };
        const goals = await storage.upsertSellerGoals(goalsData);
        res.json(goals);
      } catch {
        res.status(400).json({ error: "Erro ao salvar metas" });
      }
    },
  );

  // ==================== CUSTOMER INTERACTIONS ROUTES ====================
  v1Router.get("/customer-interactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      let customerId: number | undefined = undefined;
      if (req.query.customerId) {
        const parsed = parseInt(req.query.customerId as string);
        if (isNaN(parsed)) {
          return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
        }
        customerId = parsed;
      }
      const sellerId = scopeUserFilterToSession(req, req.query.sellerId as string | undefined);
      const parsedLimit = boundedLimitSchema.safeParse(req.query.limit ?? 50);
      if (!parsedLimit.success) {
        return sendError(res, 400, "Limite deve ser um inteiro entre 1 e 100", "INVALID_LIMIT");
      }
      const limit = parsedLimit.data;

      const interactions = await storage.getCustomerInteractions(
        tenantId,
        customerId,
        sellerId,
        limit,
      );
      res.json(interactions);
    } catch {
      res.status(500).json({ error: "Erro ao buscar histórico de interações" });
    }
  });

  v1Router.post("/customer-interactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const { customerId, type, channel, notes, outcome, taskId } = req.body;

      if (!customerId || typeof customerId !== "number") {
        return res.status(400).json({ error: "ID do cliente é obrigatório" });
      }
      if (!type || typeof type !== "string") {
        return res.status(400).json({ error: "Tipo de interação é obrigatório" });
      }
      if (!channel || typeof channel !== "string") {
        return res.status(400).json({ error: "Canal de interação é obrigatório" });
      }
      if (!(await isCustomerInTenant(tenantId, customerId))) {
        return sendError(res, 400, "Cliente inválido para este tenant", "INVALID_TENANT_REFERENCE");
      }
      if (taskId) {
        const task = await storage.getSellerTask(tenantId, taskId);
        if (!task || (task.customerId && task.customerId !== customerId)) {
          return sendError(
            res,
            400,
            "Tarefa inválida para este tenant e cliente",
            "INVALID_TENANT_REFERENCE",
          );
        }
      }

      const interactionData = {
        tenantId,
        customerId,
        sellerId: req.session.user?.id || req.body.sellerId,
        taskId: taskId || null,
        type,
        channel,
        notes: notes || null,
        outcome: outcome || null,
      };
      const interaction = await storage.createCustomerInteraction(interactionData);
      res.status(201).json(interaction);
    } catch {
      res.status(400).json({ error: "Erro ao registrar interação" });
    }
  });

  // ==================== SELLER RANKING ROUTES ====================
  v1Router.get("/seller-ranking", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const period = (req.query.period as "daily" | "weekly" | "monthly") || "weekly";
      const ranking = await storage.getSellerRanking(tenantId, period);
      res.json(ranking);
    } catch {
      res.status(500).json({ error: "Erro ao buscar ranking" });
    }
  });
}
