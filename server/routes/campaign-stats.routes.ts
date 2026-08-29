import type { Router } from "express";
import {
  configuredChannels,
  getCampaignDeliveryStats,
  getTenantId,
  logger,
  requireAuth,
  sendError,
  storage,
  supportedAudiences,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Campaign counters, delivery statistics and executable templates.
 */
export function registerCampaignStatsRoutes(v1Router: Router): void {
  // ==================== CAMPAIGN STATS ROUTES ====================
  /**
   * @description Campaign counters plus delivery statistics derived from
   *              persisted recipients. Attribution metrics (open rate,
   *              conversion, revenue) stay null until real attribution events
   *              exist, per ADR 0002.
   * @route GET /api/v1/campaigns/stats
   * @access authenticated
   */
  v1Router.get("/campaigns/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const campaigns = await storage.getCampaigns(tenantId);
      const delivery = getCampaignDeliveryStats(tenantId);

      res.json({
        total: campaigns.length,
        sent: campaigns.filter((c) => c.status === "sent").length,
        draft: campaigns.filter((c) => c.status === "draft").length,
        scheduled: campaigns.filter((c) => c.status === "scheduled").length,
        failed: campaigns.filter((c) => c.status === "failed").length,
        delivery,
        // Explicitly unavailable rather than a zero that reads as a real metric.
        attribution: {
          available: false,
          reason: "Attribution events are not collected yet",
          openRate: null,
          conversion: null,
          revenue: null,
        },
      });
    } catch (error) {
      logger.error("Campaign stats fetch failed", {
        requestId: (req as Request & { requestId?: string }).requestId,
        endpoint: "/api/v1/campaigns/stats",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar estatísticas de campanhas" });
    }
  });

  /**
   * @description Campaign templates restricted to audiences and channels the
   *              dispatcher can actually resolve, so a template never promises
   *              a segment the server cannot build.
   * @route GET /api/v1/campaigns/templates
   * @access authenticated
   */
  v1Router.get("/campaigns/templates", requireAuth, (_req: Request, res: Response) => {
    const catalog = [
      {
        id: 1,
        name: "Boas-vindas",
        channel: "email",
        audience: "Novos clientes",
        message: "Bem-vindo à nossa loja! Aproveite 10% de desconto na sua primeira compra.",
      },
      {
        id: 2,
        name: "Aniversário",
        channel: "whatsapp",
        audience: "Aniversariantes do mês",
        message: "Feliz aniversário! Ganhe um presente especial na sua próxima compra.",
      },
      {
        id: 3,
        name: "Reativação",
        channel: "sms",
        audience: "Clientes inativos",
        message: "Sentimos sua falta! Volte e ganhe 15% de desconto.",
      },
      {
        id: 4,
        name: "Relacionamento VIP",
        channel: "email",
        audience: "Clientes VIP",
        message: "Condição exclusiva para nossos clientes VIP.",
      },
    ];

    const audiences = new Set(supportedAudiences());
    const available = new Set<string>(configuredChannels());

    res.json(
      catalog
        .filter((template) => audiences.has(template.audience))
        .map((template) => ({
          ...template,
          // The UI must be able to distinguish "supported" from "ready to send".
          channelConfigured: available.has(template.channel),
        })),
    );
  });
}
