import type { Router } from "express";
import {
  ZodError,
  customerListQuerySchema,
  getAuditContext,
  getTenantId,
  handleZodError,
  insertCustomerSchema,
  requireAuth,
  requireRole,
  sendError,
  storage,
  updateCustomerSchema,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Customer CRUD for the active tenant.
 */
export function registerCustomerRoutes(v1Router: Router): void {
  // ==================== TENANT-SCOPED DATA ROUTES ====================
  /**
   * @description Retrieves all customers for the current tenant with pagination support
   * @route GET /api/v1/customers
   * @access auth
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=50] - Number of results per page (max 100)
   * @returns {object} Paginated list of customer objects with pagination metadata
   */
  v1Router.get("/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const { page, limit, search, segment, sort, order } = customerListQuerySchema.parse(
        req.query,
      );
      const offset = (page - 1) * limit;
      const { data, total } = await storage.getCustomers(tenantId, {
        limit,
        offset,
        search,
        segment,
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
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  /**
   * @description Creates a new customer in the current tenant
   * @route POST /api/v1/customers
   * @access manager, seller
   * @param {string} name - Customer's full name
   * @param {string} email - Customer's email address
   * @param {string} phone - Customer's phone number
   * @param {string} [segment] - Customer segment (e.g., VIP, Novo, Regular)
   * @param {string} [ltv] - Customer lifetime value
   * @param {string} [favoriteCategory] - Customer's favorite product category
   * @returns {object} Newly created customer object
   */
  v1Router.post(
    "/customers",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertCustomerSchema.parse({ ...req.body, tenantId });
        const customer = await storage.createCustomer(validatedData);
        res.status(201).json(customer);
      } catch (error) {
        if (error instanceof ZodError) {
          const zodError = handleZodError(error);
          return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
        }
        return sendError(res, 400, "Dados de cliente inválidos", "CUSTOMER_CREATE_ERROR");
      }
    },
  );

  /**
   * @description Updates an existing customer's information
   * @route PUT /api/v1/customers/:id
   * @access manager, seller
   * @param {number} id - Customer ID to update
   * @param {object} updates - Fields to update (name, email, phone, segment, etc.)
   * @returns {object} Updated customer object
   */
  v1Router.put(
    "/customers/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) {
          return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
        }
        const updateData = updateCustomerSchema.parse(req.body);
        const updated = await storage.updateCustomer(tenantId, customerId, updateData);
        if (!updated) {
          return sendError(res, 404, "Cliente não encontrado", "CUSTOMER_NOT_FOUND");
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar cliente" });
      }
    },
  );

  /**
   * @description Deletes a customer from the current tenant
   * @route DELETE /api/v1/customers/:id
   * @access manager, seller
   * @param {number} id - Customer ID to delete
   * @returns {object} Success message
   */
  v1Router.delete(
    "/customers/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) {
          return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteCustomer(tenantId, customerId, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "customers",
          outcome: "success",
        });
        if (!deleted) {
          return sendError(res, 404, "Cliente não encontrado", "CUSTOMER_NOT_FOUND");
        }
        res.json({ message: "Cliente excluído com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir cliente" });
      }
    },
  );
}
