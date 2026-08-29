import type { Router } from "express";
import {
  SUPPORTED_AUTOMATION_ACTIONS,
  SUPPORTED_AUTOMATION_TRIGGERS,
  SUPPORTED_DELIVERY_CHANNELS,
  ZodError,
  automationHistoryQuerySchema,
  configuredChannels,
  getAutomationHistory,
  getTenantId,
  handleZodError,
  logger,
  requireAuth,
  sendError,
  supportedAudiences,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Suggested automations, real execution history and declared capabilities.
 */
export function registerAutomationExtraRoutes(v1Router: Router): void {
  // ==================== AUTOMATION ROUTES ====================
  v1Router.get("/automations/suggested", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      // Return suggested automations based on business rules
      const suggestions = [
        {
          id: "welcome-series",
          title: "Série de Boas-vindas",
          description: "Envie 3 emails automáticos para novos clientes",
          icon: "mail",
          estimatedImpact: "+15% conversão",
        },
        {
          id: "abandoned-cart",
          title: "Carrinho Abandonado",
          description: "Recupere vendas perdidas automaticamente",
          icon: "shopping-cart",
          estimatedImpact: "+8% receita",
        },
        {
          id: "birthday",
          title: "Aniversário",
          description: "Parabenize clientes no dia do aniversário",
          icon: "gift",
          estimatedImpact: "+12% engajamento",
        },
        {
          id: "cashback-expiring",
          title: "Cashback Expirando",
          description: "Notifique sobre cashback prestes a expirar",
          icon: "dollar-sign",
          estimatedImpact: "+20% uso de cashback",
        },
        {
          id: "win-back",
          title: "Reconquista",
          description: "Reative clientes inativos há 90 dias",
          icon: "user-plus",
          estimatedImpact: "+5% reativação",
        },
      ];

      res.json(suggestions);
    } catch (error) {
      logger.error("Automation suggestions fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/automations/suggested",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar sugestões de automações" });
    }
  });

  /**
   * @description Real automation execution history for the active tenant
   * @route GET /api/v1/automations/history
   * @access authenticated
   */
  v1Router.get("/automations/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const query = automationHistoryQuerySchema.parse(req.query);
      const result = getAutomationHistory(tenantId, {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        automationId: query.automationId,
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
      logger.error("Automation history fetch failed", {
        requestId: (req as Request & { requestId?: string }).requestId,
        endpoint: "/api/v1/automations/history",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar histórico de automações" });
    }
  });

  /**
   * @description Declares which delivery channels, triggers and audiences the
   *              server can actually execute, so the UI never offers a
   *              capability that would fail closed.
   * @route GET /api/v1/automations/capabilities
   * @access authenticated
   */
  v1Router.get("/automations/capabilities", requireAuth, (_req: Request, res: Response) => {
    res.json({
      triggers: SUPPORTED_AUTOMATION_TRIGGERS,
      actions: SUPPORTED_AUTOMATION_ACTIONS,
      channels: SUPPORTED_DELIVERY_CHANNELS,
      configuredChannels: configuredChannels(),
      audiences: supportedAudiences(),
    });
  });
}
