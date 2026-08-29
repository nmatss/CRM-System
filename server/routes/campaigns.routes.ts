import type { Router } from "express";
import {
  CampaignDispatchError,
  OutboxConflictError,
  ZodError,
  executionListQuerySchema,
  getAuditContext,
  getTenantId,
  handleZodError,
  insertCampaignSchema,
  listCampaignExecutions,
  listCampaignRecipients,
  logger,
  paginationQuerySchema,
  requestCampaignDispatch,
  requireAuth,
  requireRole,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Campaign CRUD, dispatch requests and persisted executions.
 */
export function registerCampaignRoutes(v1Router: Router): void {
  v1Router.get("/campaigns", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const campaigns = await storage.getCampaigns(tenantId);
      res.json(campaigns);
    } catch {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  v1Router.post(
    "/campaigns",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertCampaignSchema.parse({ ...req.body, tenantId });
        const campaign = await storage.createCampaign(validatedData);
        res.status(201).json(campaign);
      } catch {
        res.status(400).json({ error: "Invalid campaign data" });
      }
    },
  );

  v1Router.put(
    "/campaigns/:id",
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
        const { name, channel, audience, status, date, sent, openRate, conversion, revenue } =
          req.body;

        const updateData: Record<string, any> = {};
        if (name !== undefined) updateData.name = name;
        if (channel !== undefined) updateData.channel = channel;
        if (audience !== undefined) updateData.audience = audience;
        if (status !== undefined) updateData.status = status;
        if (date !== undefined) updateData.date = date;
        if (sent !== undefined) updateData.sent = sent;
        if (openRate !== undefined) updateData.openRate = openRate;
        if (conversion !== undefined) updateData.conversion = conversion;
        if (revenue !== undefined) updateData.revenue = revenue;

        const updated = await storage.updateCampaign(tenantId, id, updateData);
        if (!updated) {
          return res.status(404).json({ error: "Campanha não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar campanha" });
      }
    },
  );

  v1Router.delete(
    "/campaigns/:id",
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
        const deleted = await storage.deleteCampaign(tenantId, id, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "campaigns",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Campanha não encontrada" });
        }
        res.json({ message: "Campanha excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir campanha" });
      }
    },
  );

  v1Router.post(
    "/campaigns/:id/send",
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

        // Materializes recipients and enqueues the job in one transaction. The
        // response is an accepted dispatch, never a delivery confirmation.
        const { execution, created } = requestCampaignDispatch({
          tenantId,
          campaignId: id,
          actorUserId: req.session.user?.id ?? null,
        });

        res.status(created ? 202 : 200).json({
          message: created
            ? "Envio agendado. O status por destinatário fica disponível na execução."
            : "Envio já agendado para esta versão da campanha.",
          execution,
        });
      } catch (error) {
        if (error instanceof CampaignDispatchError) {
          const status = error.code === "NOT_FOUND" ? 404 : 400;
          return sendError(res, status, error.message, error.code);
        }
        if (error instanceof OutboxConflictError) {
          return sendError(res, 409, "Envio conflitante já registrado", "OUTBOX_CONFLICT");
        }
        logger.error("Campaign dispatch request failed", {
          requestId: (req as Request & { requestId?: string }).requestId,
          endpoint: "/api/v1/campaigns/:id/send",
          tenantId: getTenantId(req),
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: "Erro ao agendar envio da campanha" });
      }
    },
  );

  /**
   * @description Lists persisted campaign executions for the active tenant
   * @route GET /api/v1/campaigns/executions
   * @access authenticated
   */
  v1Router.get("/campaigns/executions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const query = executionListQuerySchema.parse(req.query);
      const result = listCampaignExecutions(tenantId, {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        campaignId: query.campaignId,
      });
      res.json({
        data: result.data,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const parsed = handleZodError(error);
        return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
      }
      res.status(500).json({ error: "Erro ao buscar execuções de campanha" });
    }
  });

  /**
   * @description Lists the per-recipient delivery status of one execution
   * @route GET /api/v1/campaigns/executions/:executionId/recipients
   * @access authenticated
   */
  v1Router.get(
    "/campaigns/executions/:executionId/recipients",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const executionId = parseInt(req.params.executionId);
        if (isNaN(executionId)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const query = paginationQuerySchema.parse(req.query);
        const result = listCampaignRecipients(tenantId, executionId, {
          limit: query.limit,
          offset: (query.page - 1) * query.limit,
        });
        res.json({
          data: result.data,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / query.limit),
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          const parsed = handleZodError(error);
          return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
        }
        res.status(500).json({ error: "Erro ao buscar destinatários da execução" });
      }
    },
  );
}
