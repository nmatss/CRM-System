import type { Router } from "express";
import {
  CashbackLedgerError,
  ZodError,
  boundedLimitSchema,
  cashbackLedgerOperationSchema,
  getAuditContext,
  getTenantId,
  handleZodError,
  logger,
  requireAuth,
  requireRole,
  sendError,
  storage,
  z,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Integer cashback ledger: credit, debit, reversal, expiry and reconciliation.
 */
export function registerCashbackRoutes(v1Router: Router): void {
  // ==================== CASHBACK ROUTES ====================
  v1Router.get("/cashback/distribution", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const distribution = await storage.getCashbackDistribution(tenantId);
      res.json(distribution);
    } catch (error) {
      logger.error("Cashback distribution fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/cashback/distribution",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar distribuição de cashback" });
    }
  });

  v1Router.get("/cashback/expiring", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      let daysAhead = 30;
      if (req.query.days) {
        const parsed = parseInt(req.query.days as string);
        if (!isNaN(parsed)) {
          daysAhead = parsed;
        }
      }
      const expiring = await storage.getExpiringCashback(tenantId, daysAhead);
      res.json(expiring);
    } catch (error) {
      logger.error("Expiring cashback fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/cashback/expiring",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar cashback expirando" });
    }
  });

  v1Router.get("/cashback/transactions", requireAuth, async (req: Request, res: Response) => {
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
      const parsedLimit = boundedLimitSchema.safeParse(req.query.limit ?? 50);
      if (!parsedLimit.success) {
        return sendError(res, 400, "Limite deve ser um inteiro entre 1 e 100", "INVALID_LIMIT");
      }
      const limit = parsedLimit.data;

      const transactions = await storage.getCashbackTransactions(tenantId, customerId, limit);
      res.json(transactions);
    } catch (error) {
      logger.error("Cashback transactions fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/cashback/transactions",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar transações de cashback" });
    }
  });

  const sendCashbackLedgerError = (res: Response, error: unknown) => {
    if (error instanceof ZodError) {
      const parsed = handleZodError(error);
      return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
    }
    if (error instanceof CashbackLedgerError) {
      const status =
        error.code === "TRANSACTION_NOT_FOUND"
          ? 404
          : error.code === "INVALID_TENANT_REFERENCE"
            ? 400
            : 409;
      return sendError(res, status, error.message, error.code);
    }
    return sendError(res, 400, "Operação de cashback inválida", "CASHBACK_OPERATION_ERROR");
  };

  v1Router.post("/cashback/credit", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const input = cashbackLedgerOperationSchema.parse(req.body);
      res
        .status(201)
        .json(await storage.creditCashback(getTenantId(req), input, getAuditContext(req)));
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });

  v1Router.post("/cashback/debit", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const input = cashbackLedgerOperationSchema.parse(req.body);
      res
        .status(201)
        .json(await storage.debitCashback(getTenantId(req), input, getAuditContext(req)));
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });

  v1Router.post(
    "/cashback/transactions/:id/reverse",
    requireAuth,
    requireRole("manager"),
    async (req, res) => {
      try {
        const transactionId = z.coerce.number().int().positive().parse(req.params.id);
        const { idempotencyKey } = z
          .object({ idempotencyKey: z.string().trim().min(8).max(200) })
          .strict()
          .parse(req.body);
        res
          .status(201)
          .json(
            await storage.reverseCashback(
              getTenantId(req),
              transactionId,
              idempotencyKey,
              getAuditContext(req),
            ),
          );
      } catch (error) {
        sendCashbackLedgerError(res, error);
      }
    },
  );

  v1Router.post("/cashback/expire", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const { now } = z
        .object({ now: z.string().datetime().optional() })
        .strict()
        .parse(req.body ?? {});
      res.json({
        transactions: await storage.expireCashback(getTenantId(req), now, getAuditContext(req)),
      });
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });

  v1Router.get("/cashback/reconcile", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const parsed = z
        .object({ customerId: z.coerce.number().int().positive().optional() })
        .strict()
        .parse(req.query);
      const results = await storage.reconcileCashback(
        getTenantId(req),
        parsed.customerId,
        getAuditContext(req),
      );
      res.json({ consistent: results.every((item) => item.consistent), results });
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });
}
