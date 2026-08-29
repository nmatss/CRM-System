import type { Router } from "express";
import {
  ZodError,
  getAuditContext,
  getTenantId,
  handleZodError,
  insertProductSchema,
  productListQuerySchema,
  requireAuth,
  requireRole,
  sendError,
  storage,
  updateProductSchema,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Product catalogue for the active tenant.
 */
export function registerProductRoutes(v1Router: Router): void {
  /**
   * @description Retrieves all products for the current tenant with pagination support
   * @route GET /api/v1/products
   * @access auth
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=50] - Number of results per page (max 100)
   * @returns {object} Paginated list of product objects with pagination metadata
   */
  v1Router.get("/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const { page, limit, search, status, sort, order } = productListQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;
      const { data, total } = await storage.getProducts(tenantId, {
        limit,
        offset,
        search,
        status,
        sort,
        order,
      });
      const totalPages = Math.ceil(total / limit);

      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = handleZodError(error);
        return sendError(res, 400, zodError.message, "INVALID_QUERY", zodError.details);
      }
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  /**
   * @description Creates a new product in the current tenant
   * @route POST /api/v1/products
   * @access manager
   * @param {string} name - Product name
   * @param {string} category - Product category
   * @param {string} price - Product price (formatted as currency)
   * @param {number} stock - Available stock quantity
   * @param {string} [status] - Product status (Ativo, Inativo)
   * @param {string} [image] - Product image URL
   * @returns {object} Newly created product object
   */
  v1Router.post(
    "/products",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertProductSchema.parse({ ...req.body, tenantId });
        const product = await storage.createProduct(validatedData);
        res.status(201).json(product);
      } catch (error) {
        if (error instanceof ZodError) {
          const zodError = handleZodError(error);
          return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
        }
        return sendError(res, 400, "Dados de produto inválidos", "PRODUCT_CREATE_ERROR");
      }
    },
  );

  /**
   * @description Updates an existing product's information
   * @route PUT /api/v1/products/:id
   * @access manager
   * @param {number} id - Product ID to update
   * @param {object} updates - Fields to update (name, category, price, stock, status, image)
   * @returns {object} Updated product object
   */
  v1Router.put(
    "/products/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
          return sendError(res, 400, "ID de produto inválido", "INVALID_ID");
        }
        const updateData = updateProductSchema.parse(req.body);
        const updated = await storage.updateProduct(tenantId, productId, updateData);
        if (!updated) {
          return sendError(res, 404, "Produto não encontrado", "PRODUCT_NOT_FOUND");
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar produto" });
      }
    },
  );

  /**
   * @description Deletes a product from the current tenant
   * @route DELETE /api/v1/products/:id
   * @access manager
   * @param {number} id - Product ID to delete
   * @returns {object} Success message
   */
  v1Router.delete(
    "/products/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
          return sendError(res, 400, "ID de produto inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteProduct(tenantId, productId, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "products",
          outcome: "success",
        });
        if (!deleted) {
          return sendError(res, 404, "Produto não encontrado", "PRODUCT_NOT_FOUND");
        }
        res.json({ message: "Produto excluído com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir produto" });
      }
    },
  );
}
