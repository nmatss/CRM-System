import type { Router } from "express";
import { getTenantId, logger, requireAuth, sendError, storage } from "./shared";
import type { Request, Response } from "./shared";

/**
 * Customer 360, history and cashback views.
 */
export function registerCustomer360Routes(v1Router: Router): void {
  // ==================== CUSTOMER 360 ROUTES ====================
  v1Router.get("/customers/:id/360", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
      }
      const customer360 = await storage.getCustomer360(tenantId, customerId);

      if (!customer360) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      res.json(customer360);
    } catch (error) {
      logger.error("Customer 360 fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/customers/:id/360",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        customerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar visão 360 do cliente" });
    }
  });

  v1Router.get("/customers/:id/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
      }
      const customer = await storage.getCustomer(tenantId, customerId);

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const history = await storage.getCustomerOrderHistory(tenantId, customerId);

      res.json({
        customer,
        ...history,
      });
    } catch (error) {
      logger.error("Customer history fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/customers/:id/history",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        customerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar histórico do cliente" });
    }
  });

  v1Router.get("/customers/:id/cashback", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
      }
      const customer = await storage.getCustomer(tenantId, customerId);

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const transactions = await storage.getCashbackTransactions(tenantId, customerId);
      const balance = await storage.getCustomerCashbackBalance(tenantId, customerId);

      res.json({
        customer,
        balance,
        transactions,
      });
    } catch (error) {
      logger.error("Customer cashback fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/customers/:id/cashback",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        customerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar cashback do cliente" });
    }
  });
}
