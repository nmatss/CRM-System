import type { Router } from "express";
import {
  getAuditContext,
  getTenantId,
  handleZodError,
  logger,
  requireAuth,
  requireRole,
  sanitizeExportRows,
  sendError,
  storage,
  z,
  ZodError,
} from "./shared";
import {
  DUPLICATE_STRATEGIES,
  IMPORT_MODES,
  ImportRefusedError,
  MAX_IMPORT_ROWS,
  importCustomers,
  importProducts,
  type ImportOutcome,
} from "../services/bulkImport";
import type { Request, Response } from "./shared";

/**
 * Bulk import and export with sanitised spreadsheet output.
 */
export function registerImportExportRoutes(v1Router: Router): void {
  // ==================== IMPORT/EXPORT ROUTES ====================

  /**
   * Import requests are explicit about what they will do. `dry-run` is the
   * default because committing a spreadsheet blind is how a catalogue gets
   * duplicated, and the caller has to opt into writing.
   */
  const importRequestSchema = z
    .object({
      rows: z.array(z.unknown()).max(MAX_IMPORT_ROWS).optional(),
      // Legacy field names kept so existing callers keep working.
      data: z.array(z.unknown()).max(MAX_IMPORT_ROWS).optional(),
      customers: z.array(z.unknown()).max(MAX_IMPORT_ROWS).optional(),
      products: z.array(z.unknown()).max(MAX_IMPORT_ROWS).optional(),
      mode: z.enum(IMPORT_MODES).default("dry-run"),
      onDuplicate: z.enum(DUPLICATE_STRATEGIES).default("skip"),
      atomic: z.boolean().default(false),
    })
    .strict();

  function readImportRequest(req: Request) {
    const parsed = importRequestSchema.parse(req.body ?? {});
    const rows = parsed.rows ?? parsed.data ?? parsed.customers ?? parsed.products ?? [];
    return { rows, mode: parsed.mode, onDuplicate: parsed.onDuplicate, atomic: parsed.atomic };
  }

  function handleImportError(req: Request, res: Response, error: unknown, entity: string) {
    if (error instanceof ImportRefusedError) {
      // Not a server failure: the caller asked to be stopped.
      return res.status(409).json({ error: error.message, ...error.outcome });
    }
    if (error instanceof ZodError) {
      const parsed = handleZodError(error);
      return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
    }
    logger.error(`${entity} import failed`, {
      requestId: req.requestId,
      endpoint: `/api/v1/import/${entity}`,
      userId: req.session.user?.id,
      tenantId: getTenantId(req),
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ error: `Erro ao importar ${entity === "customers" ? "clientes" : "produtos"}` });
  }

  async function auditImport(
    req: Request,
    tenantId: number,
    entity: string,
    outcome: ImportOutcome,
  ) {
    if (outcome.mode !== "commit") return;
    await storage.appendAuditEvent({
      ...getAuditContext(req),
      tenantId,
      action: "data.imported",
      targetType: entity,
      outcome: "success",
      metadata: {
        entityType: entity,
        rowCount: outcome.totals.received,
        created: outcome.totals.created,
        updated: outcome.totals.updated,
        skipped: outcome.totals.skipped,
      },
    });
  }

  v1Router.post(
    "/import/customers",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const request = readImportRequest(req);
        if (request.rows.length === 0) {
          return sendError(res, 400, "Envie ao menos uma linha", "EMPTY_IMPORT");
        }

        const outcome = importCustomers({ tenantId, ...request });
        await auditImport(req, tenantId, "customers", outcome);
        res.json(outcome);
      } catch (error) {
        return handleImportError(req, res, error, "customers");
      }
    },
  );

  v1Router.post(
    "/import/products",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const request = readImportRequest(req);
        if (request.rows.length === 0) {
          return sendError(res, 400, "Envie ao menos uma linha", "EMPTY_IMPORT");
        }

        const outcome = importProducts({ tenantId, ...request });
        await auditImport(req, tenantId, "products", outcome);
        res.json(outcome);
      } catch (error) {
        return handleImportError(req, res, error, "products");
      }
    },
  );

  v1Router.get("/export/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customersResult = await storage.getCustomers(tenantId);
      await storage.appendAuditEvent({
        ...getAuditContext(req),
        tenantId,
        action: "data.exported",
        targetType: "customers",
        outcome: "success",
        metadata: { entityType: "customers", rowCount: customersResult.data.length },
      });
      res.json(sanitizeExportRows(customersResult.data));
    } catch {
      res.status(500).json({ error: "Erro ao exportar clientes" });
    }
  });

  v1Router.get("/export/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const productsResult = await storage.getProducts(tenantId);
      await storage.appendAuditEvent({
        ...getAuditContext(req),
        tenantId,
        action: "data.exported",
        targetType: "products",
        outcome: "success",
        metadata: { entityType: "products", rowCount: productsResult.data.length },
      });
      res.json(sanitizeExportRows(productsResult.data));
    } catch {
      res.status(500).json({ error: "Erro ao exportar produtos" });
    }
  });

  v1Router.get("/export/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const ordersResult = await storage.getOrders(tenantId);
      await storage.appendAuditEvent({
        ...getAuditContext(req),
        tenantId,
        action: "data.exported",
        targetType: "orders",
        outcome: "success",
        metadata: { entityType: "orders", rowCount: ordersResult.data.length },
      });
      res.json(sanitizeExportRows(ordersResult.data));
    } catch {
      res.status(500).json({ error: "Erro ao exportar pedidos" });
    }
  });
}
