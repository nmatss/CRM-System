import type { Router } from "express";
import {
  MAX_IMPORT_ROWS,
  getAuditContext,
  getTenantId,
  logger,
  parseImportedNumber,
  requireAuth,
  requireRole,
  sanitizeExportRows,
  sanitizeImportedText,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Bulk import and export with sanitised spreadsheet output.
 */
export function registerImportExportRoutes(v1Router: Router): void {
  // ==================== IMPORT/EXPORT ROUTES ====================
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

        const data = Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body?.customers)
            ? req.body.customers
            : [];
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ error: "Dados inválidos. Envie um array de clientes." });
        }
        if (data.length > MAX_IMPORT_ROWS) {
          return res
            .status(413)
            .json({ error: `Importação limitada a ${MAX_IMPORT_ROWS} clientes por envio.` });
        }

        const results = { success: 0, errors: [] as string[] };

        for (let index = 0; index < data.length; index++) {
          const row = data[index];
          try {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
              results.errors.push(`Linha ${index + 1}: formato inválido`);
              continue;
            }
            const customerData = {
              tenantId,
              name: sanitizeImportedText(row.name || row.nome),
              email: sanitizeImportedText(row.email),
              phone: sanitizeImportedText(row.phone || row.telefone),
              segment: sanitizeImportedText(row.segment || row.segmento, "Novo"),
              ltv: Math.max(0, parseImportedNumber(row.ltv ?? row.valor ?? row.valorTotal)),
              lastPurchase: sanitizeImportedText(
                row.lastPurchase || row.ultimaCompra || new Date().toLocaleDateString("pt-BR"),
              ),
              favoriteCategory: sanitizeImportedText(row.favoriteCategory || row.categoriaFavorita),
            };

            if (!customerData.name) {
              results.errors.push(`Linha ${index + 1}: cliente sem nome`);
              continue;
            }

            await storage.createCustomer(customerData);
            results.success++;
          } catch (err: any) {
            results.errors.push(`Linha ${index + 1}: ${err.message}`);
          }
        }

        res.json({
          message: `Importação concluída: ${results.success} clientes importados.`,
          success: results.success,
          errors: results.errors.slice(0, 10),
          totalErrors: results.errors.length,
        });
      } catch (error) {
        logger.error("Customer import failed", {
          requestId: (req as any).requestId,
          endpoint: "/api/v1/import/customers",
          userId: req.session.user?.id,
          tenantId: getTenantId(req),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(500).json({ error: "Erro ao importar clientes" });
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

        const data = Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body?.products)
            ? req.body.products
            : [];
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ error: "Dados inválidos. Envie um array de produtos." });
        }
        if (data.length > MAX_IMPORT_ROWS) {
          return res
            .status(413)
            .json({ error: `Importação limitada a ${MAX_IMPORT_ROWS} produtos por envio.` });
        }

        const results = { success: 0, errors: [] as string[] };

        for (let index = 0; index < data.length; index++) {
          const row = data[index];
          try {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
              results.errors.push(`Linha ${index + 1}: formato inválido`);
              continue;
            }
            const productData = {
              tenantId,
              name: sanitizeImportedText(row.name || row.nome),
              category: sanitizeImportedText(row.category || row.categoria),
              price: Math.max(0, parseImportedNumber(row.price ?? row.preco)),
              stock: Math.max(0, Math.trunc(parseImportedNumber(row.stock ?? row.estoque))),
              status: sanitizeImportedText(row.status, "Ativo"),
              image: sanitizeImportedText(row.image || row.imagem),
            };

            if (!productData.name) {
              results.errors.push(`Linha ${index + 1}: produto sem nome`);
              continue;
            }

            await storage.createProduct(productData);
            results.success++;
          } catch (err: any) {
            results.errors.push(`Linha ${index + 1}: ${err.message}`);
          }
        }

        res.json({
          message: `Importação concluída: ${results.success} produtos importados.`,
          success: results.success,
          errors: results.errors.slice(0, 10),
          totalErrors: results.errors.length,
        });
      } catch (error) {
        logger.error("Product import failed", {
          requestId: (req as any).requestId,
          endpoint: "/api/v1/import/products",
          userId: req.session.user?.id,
          tenantId: getTenantId(req),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(500).json({ error: "Erro ao importar produtos" });
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
